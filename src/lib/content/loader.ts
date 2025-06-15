import { getNotionClient } from '@/lib/notion/client';
import { logError, retry } from '@/lib/utils/errors';
import type { ImageInfo } from '@/lib/types/notion';
import { extractMultipleImageDimensions } from '@/lib/image/dimensions';
import type { BlogPost } from '@/lib/types/notion';
import type { NotionClient, PostSummary } from '@/lib/notion/client';

// 설정 상수
const CONFIG = {
  BATCH_SIZE: 5,
  RATE_LIMIT_DELAY: 500,
  MAX_RETRIES: 3,
  RETRY_BASE_DELAY: 1000,
  DEFAULT_IMAGE_DIMENSIONS: { width: 1200, height: 900 },
  MEMORY_WARNING_THRESHOLD: 1000,
  IMAGE_PROCESSING_CONCURRENCY: 3,
} as const;

// BlogPost 데이터 타입 정의 (Astro Content Collections용)
interface BlogPostData {
  id: string;
  title: string;
  description: string;
  slug: string;
  published: boolean;
  publishDate: string;
  lastModified: string;
  tags: string[];
  featured: boolean;
  author: string;
  content: string;
  readingTime: number;
  images: ImageInfo[];
}

// Astro v5 Content Loader API 타입 정의
interface DataEntry<T = BlogPostData> {
  id: string;
  data: T;
  filePath?: string;
  body?: string;
  digest?: string;
  rendered?: unknown;
}

interface DataStore {
  set: (entry: DataEntry) => boolean;
  get: (id: string) => DataEntry | undefined;
  keys: () => Iterable<string>;
  delete: (id: string) => boolean;
  has: (id: string) => boolean;
  entries: () => Iterable<[string, DataEntry]>;
}

interface LoaderContext {
  collection: string;
  store: DataStore;
  meta: Map<string, unknown>;
  logger: {
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
  };
  parseData: (data: { id: string; data: unknown }) => unknown;
  generateDigest: (data: Record<string, unknown>) => string;
  renderMarkdown: (content: string) => unknown;
}

interface Loader {
  name: string;
  load: (context: LoaderContext) => Promise<void>;
}

export const blogLoader: Loader = {
  name: 'notion-blog-loader',

  load: async function ({
    store,
    logger,
    parseData,
    generateDigest,
    renderMarkdown,
  }: LoaderContext): Promise<void> {
    const client = getNotionClient();
    const startTime = Date.now();

    logger.info('🚀 Starting Notion content sync...');

    try {
      const publishedPostSummaries = await client.getPostSummaries();
      logger.info(`📊 Found ${publishedPostSummaries.length} published posts in Notion`);

      const syncStats = createSyncStatsTracker();
      const processedPostIds = new Set<string>();

      const postBatches = createConcurrentBatches(publishedPostSummaries, CONFIG.BATCH_SIZE);

      // 메모리 사용량 모니터링
      if (publishedPostSummaries.length > CONFIG.MEMORY_WARNING_THRESHOLD) {
        logger.warn(`⚠️ Large batch detected: ${publishedPostSummaries.length} posts`);
      }
      logger.info(
        `🔄 Processing ${postBatches.length} batches (${CONFIG.BATCH_SIZE} posts per batch)`,
      );

      for (let batchIndex = 0; batchIndex < postBatches.length; batchIndex++) {
        const currentBatch = postBatches[batchIndex];

        if (!currentBatch) {
          logger.warn(`⚠️ Batch ${batchIndex} is undefined, skipping`);
          continue;
        }

        const batchStartTime = Date.now();
        logger.info(
          `📦 Processing batch ${batchIndex + 1}/${postBatches.length} (${currentBatch.length} posts)`,
        );

        const batchResults = await Promise.allSettled(
          currentBatch.map(async (postSummary) => {
            processedPostIds.add(postSummary.slug);

            const contentDigest = generateContentDigest(postSummary, generateDigest);
            const existingEntry = store.get(postSummary.slug);

            if (hasContentChanged(existingEntry, contentDigest)) {
              logContentChangeInDev(logger, postSummary, existingEntry, contentDigest);
              return await processChangedPost(
                postSummary,
                contentDigest,
                client,
                store,
                parseData,
                renderMarkdown,
                logger,
              );
            } else {
              return { type: 'skipped' as const, summary: postSummary };
            }
          }),
        );

        updateSyncStats(batchResults, syncStats, logger);

        logBatchCompletion(batchIndex, batchStartTime, logger);

        const isNotLastBatch = batchIndex < postBatches.length - 1;
        if (isNotLastBatch) {
          await delay(CONFIG.RATE_LIMIT_DELAY);
        }
      }

      const deletedPostCount = removeDeletedPosts(store, processedPostIds, logger);

      const finalStats = finalizeSyncStats(
        syncStats,
        deletedPostCount,
        publishedPostSummaries.length,
        startTime,
      );
      logSyncSummary(finalStats, logger);
    } catch (error) {
      logError(error, 'blogLoader');
      logger.error('❌ Failed to sync with Notion');
      throw error;
    }
  },
};

function createConcurrentBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

async function extractAndProcessImages(htmlContent: string): Promise<ImageInfo[]> {
  const imageMatches = extractImageUrlsFromHtml(htmlContent);

  if (imageMatches.length === 0) return [];

  // 배치 처리로 에러 격리와 진행 상황 추적
  return await processImagesInBatches(imageMatches);
}

/**
 * 실제로는 스트리밍이 아닌 배치 처리입니다.
 * 메모리 효율성 개선보다는 에러 격리와 진행률 표시가 주 목적입니다.
 */
async function processImagesInBatches(
  imageMatches: Array<{ url: string; alt: string }>,
): Promise<ImageInfo[]> {
  // 적은 수의 이미지는 단순 처리가 더 효율적
  if (imageMatches.length <= CONFIG.IMAGE_PROCESSING_CONCURRENCY) {
    return processImageBatch(imageMatches);
  }

  const processedImages: ImageInfo[] = [];
  const totalImages = imageMatches.length;

  // 배치 단위로 이미지 처리 - 에러 격리와 진행률 표시
  for (let i = 0; i < totalImages; i += CONFIG.IMAGE_PROCESSING_CONCURRENCY) {
    const batch = imageMatches.slice(i, i + CONFIG.IMAGE_PROCESSING_CONCURRENCY);
    const batchResults = await processImageBatch(batch);
    processedImages.push(...batchResults);

    // 진행률 로깅 (개발 환경에서만)
    if (import.meta.env.DEV && totalImages > CONFIG.IMAGE_PROCESSING_CONCURRENCY) {
      const progress = Math.min(i + CONFIG.IMAGE_PROCESSING_CONCURRENCY, totalImages);
      console.log(`🖼️  Image batch processed: ${progress}/${totalImages}`);
    }

    // API 부하 분산을 위한 짧은 지연
    if (i + CONFIG.IMAGE_PROCESSING_CONCURRENCY < totalImages) {
      await delay(100);
    }
  }

  return processedImages;
}

async function processImageBatch(
  imageMatches: Array<{ url: string; alt: string }>,
): Promise<ImageInfo[]> {
  const batchUrls = imageMatches.map((match) => match.url);

  try {
    const dimensionsMap = await extractMultipleImageDimensions(
      batchUrls,
      CONFIG.IMAGE_PROCESSING_CONCURRENCY,
    );
    return createImageInfoList(imageMatches, dimensionsMap);
  } catch (error) {
    return imageMatches.map(({ url, alt }) => ({
      url,
      alt,
      ...CONFIG.DEFAULT_IMAGE_DIMENSIONS,
      caption: alt,
      blurDataURL: createMinimalPlaceholder(
        CONFIG.DEFAULT_IMAGE_DIMENSIONS.width,
        CONFIG.DEFAULT_IMAGE_DIMENSIONS.height,
      ),
    }));
  }
}

function extractImageUrlsFromHtml(htmlContent: string): Array<{ url: string; alt: string }> {
  const imageRegex = /<img[^>]+src="([^"]+)"[^>]*(?:alt="([^"]*)")?[^>]*>/g;
  const imageMatches: Array<{ url: string; alt: string }> = [];
  let regexMatch;

  while ((regexMatch = imageRegex.exec(htmlContent)) !== null) {
    const imageUrl = regexMatch[1] || '';
    const altText = regexMatch[2] || '';
    imageMatches.push({ url: imageUrl, alt: altText });
  }

  return imageMatches;
}

function createImageInfoList(
  imageMatches: Array<{ url: string; alt: string }>,
  dimensionsMap: Map<string, { width: number; height: number }>,
): ImageInfo[] {
  return imageMatches.map(({ url, alt }) => {
    const imageDimensions = dimensionsMap.get(url) || CONFIG.DEFAULT_IMAGE_DIMENSIONS;

    return {
      url,
      alt,
      width: imageDimensions.width,
      height: imageDimensions.height,
      caption: alt,
      blurDataURL: createMinimalPlaceholder(imageDimensions.width, imageDimensions.height),
    };
  });
}

function createMinimalPlaceholder(imageWidth: number, imageHeight: number): string {
  const BACKGROUND_COLOR = '#f8f9fa';
  const PLACEHOLDER_COLOR = '#e9ecef';

  const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${imageWidth}" height="${imageHeight}" viewBox="0 0 ${imageWidth} ${imageHeight}">
    <rect width="100%" height="100%" fill="${BACKGROUND_COLOR}"/>
    <rect x="30%" y="45%" width="40%" height="10%" fill="${PLACEHOLDER_COLOR}" rx="2"/>
  </svg>`;

  return `data:image/svg+xml,${encodeURIComponent(placeholderSvg)}`;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function createSyncStatsTracker(): SyncStats {
  return {
    updatedCount: 0,
    unchangedCount: 0,
    skippedCount: 0,
    errorCount: 0,
  };
}

function generateContentDigest(
  postSummary: PostSummary,
  generateDigest: (data: Record<string, unknown>) => string,
) {
  /**
   * Notion의 `last_edited_time` 는 페이지 내 공식(Formula)이나 Roll-up 속성이
   * 재계산될 때도 함께 갱신되는 특성이 있다. 그 결과 실제 콘텐츠가 변하지
   * 않았는데도 매 분(또는 더 자주) 타임스탬프가 변해 digest 가 달라지고,
   * 모든 글을 다시 fetch 하는 불필요한 빌드가 발생한다.
   *
   * 1. 날짜(YYYY-MM-DD) 단위로만 비교하여 불필요한 무효화를 줄인다.
   * 2. 발행 여부가 토글되면 즉시 반영되어야 하므로 `published` 값을 digest 에 포함한다.
   * 3. 제목 변경은 실제 컨텐츠 변경과 동일하게 취급하므로 포함한다.
   */
  const modifiedDate = new Date(postSummary.lastModified).toISOString().split('T')[0]; // e.g. "2025-06-15"

  return generateDigest({
    date: modifiedDate,
    title: postSummary.title.trim(),
    published: postSummary.published ?? false,
  });
}

function hasContentChanged(
  existingEntry: { digest?: string } | undefined,
  newDigest: string,
): boolean {
  return !existingEntry || existingEntry.digest !== newDigest;
}

function logContentChangeInDev(
  logger: LoaderContext['logger'],
  postSummary: PostSummary,
  existingEntry: { digest?: string } | undefined,
  newDigest: string,
): void {
  if (import.meta.env.DEV && existingEntry) {
    logger.info(`🔄 Content changed for "${postSummary.title}"`);
    logger.info(`   Previous digest: ${existingEntry.digest}`);
    logger.info(`   Current digest:  ${newDigest}`);
  }
}

async function processChangedPost(
  postSummary: PostSummary,
  contentDigest: string,
  client: NotionClient,
  store: LoaderContext['store'],
  parseData: LoaderContext['parseData'],
  renderMarkdown: LoaderContext['renderMarkdown'],
  logger: LoaderContext['logger'],
) {
  try {
    const fullPost = await fetchPostWithRetry(postSummary, client, logger);
    const processedImages = await processPostImages(fullPost, logger);
    const astroData = createAstroPostData(fullPost, processedImages);

    return await storeProcessedPost(astroData, contentDigest, store, parseData, renderMarkdown);
  } catch (error) {
    logError(error, `Failed to fetch post: ${postSummary.id}`);
    return { type: 'error' as const, summary: postSummary, error };
  }
}

async function fetchPostWithRetry(
  postSummary: PostSummary,
  client: NotionClient,
  logger: LoaderContext['logger'],
): Promise<BlogPost> {
  return await retry(() => client.getFullPost(postSummary.id), {
    maxAttempts: CONFIG.MAX_RETRIES,
    delay: CONFIG.RETRY_BASE_DELAY,
    backoff: true,
    onRetry: (error, attempt) => {
      if (error.message.includes('429') || error.message.includes('rate')) {
        logger.warn(
          `🚦 Rate limited for ${postSummary.title}, retrying (${attempt}/${CONFIG.MAX_RETRIES})`,
        );
      }
    },
  });
}

async function processPostImages(
  fullPost: BlogPost,
  logger: LoaderContext['logger'],
): Promise<ImageInfo[]> {
  if (!fullPost.content) return [];

  const startTime = Date.now();
  const processedImages = await extractAndProcessImages(fullPost.content).catch((error) => {
    logger.warn(`⚠️ Image processing failed for "${fullPost.title}": ${error.message}`);
    return [];
  });

  if (processedImages.length > 0) {
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(
      `🖼️  Processed ${processedImages.length} images for "${fullPost.title}" in ${processingTime}s`,
    );
  }

  return processedImages;
}

async function storeProcessedPost(
  astroData: BlogPostData,
  contentDigest: string,
  store: LoaderContext['store'],
  parseData: LoaderContext['parseData'],
  renderMarkdown: LoaderContext['renderMarkdown'],
) {
  const parsedData = (await parseData({ id: astroData.slug, data: astroData })) as BlogPostData;
  const _renderedContent = astroData.content ? await renderMarkdown(astroData.content) : undefined;

  store.set({
    id: astroData.slug,
    data: parsedData,
    digest: contentDigest,
    rendered: _renderedContent,
  });

  return {
    type: 'updated' as const,
    summary: { title: astroData.title } as PostSummary,
  };
}

function createAstroPostData(fullPost: BlogPost, processedImages: ImageInfo[]): BlogPostData {
  return {
    id: fullPost.id,
    title: fullPost.title,
    description: fullPost.description || '',
    slug: fullPost.slug,
    published: fullPost.published,
    publishDate: fullPost.publishDate.toISOString(),
    lastModified: fullPost.lastModified.toISOString(),
    tags: fullPost.tags,
    featured: fullPost.featured,
    author: fullPost.author || '',
    content: fullPost.content || '',
    readingTime: fullPost.readingTime || 0,
    images: processedImages,
  };
}

interface SyncResult {
  status: 'fulfilled' | 'rejected';
  value?: {
    type: 'updated' | 'unchanged' | 'error' | 'skipped';
    summary: PostSummary;
    error?: unknown;
  };
  reason?: unknown;
}

interface SyncStats {
  updatedCount: number;
  unchangedCount: number;
  skippedCount: number;
  errorCount: number;
}

function updateSyncStats(
  batchResults: SyncResult[],
  syncStats: SyncStats,
  logger: LoaderContext['logger'],
): void {
  batchResults.forEach((result) => {
    if (result.status === 'fulfilled' && result.value) {
      switch (result.value.type) {
        case 'updated':
          syncStats.updatedCount++;
          logger.info(`✅ Updated: ${result.value.summary.title}`);
          break;
        case 'unchanged':
          syncStats.unchangedCount++;
          break;
        case 'skipped':
          syncStats.skippedCount++;
          break;
        case 'error':
          syncStats.errorCount++;
          logger.error(`❌ Error: ${result.value.summary.title}`);
          break;
      }
    } else {
      syncStats.errorCount++;
      logger.error(`❌ Unexpected error: ${result.reason}`);
    }
  });
}

function logBatchCompletion(
  batchIndex: number,
  batchStartTime: number,
  logger: LoaderContext['logger'],
): void {
  const batchDurationSeconds = ((Date.now() - batchStartTime) / 1000).toFixed(2);
  logger.info(`⏱️  Batch ${batchIndex + 1} completed in ${batchDurationSeconds}s`);
}

function removeDeletedPosts(
  store: LoaderContext['store'],
  processedPostIds: Set<string>,
  logger: LoaderContext['logger'],
): number {
  let deletedCount = 0;
  for (const existingPostId of store.keys()) {
    if (!processedPostIds.has(existingPostId)) {
      store.delete(existingPostId);
      deletedCount++;
      logger.info(`🗑️  Removed deleted post: ${existingPostId}`);
    }
  }
  return deletedCount;
}

function finalizeSyncStats(
  syncStats: SyncStats,
  deletedCount: number,
  totalPosts: number,
  startTime: number,
) {
  const totalDurationSeconds = ((Date.now() - startTime) / 1000).toFixed(2);

  return {
    total: totalPosts,
    updated: syncStats.updatedCount,
    skipped: syncStats.skippedCount,
    deleted: deletedCount,
    errors: syncStats.errorCount,
    duration: totalDurationSeconds,
  };
}

function logSyncSummary(
  stats: ReturnType<typeof finalizeSyncStats>,
  logger: LoaderContext['logger'],
): void {
  logger.info('📊 Sync Summary:');
  logger.info(`  ✅ Updated: ${stats.updated}`);
  logger.info(`  ⏭️  Skipped: ${stats.skipped}`);
  logger.info(`  🗑️  Deleted: ${stats.deleted}`);
  logger.info(`  ❌ Errors: ${stats.errors}`);
  logger.info(`  ⏱️  Total time: ${stats.duration}s`);
  logger.info(`  📈 Avg per post: ${(parseFloat(stats.duration) / stats.total).toFixed(3)}s`);

  if (import.meta.env.DEV) {
    logger.info('Sync metadata:');
    logger.info(`  Last sync: ${new Date().toISOString()}`);
    logger.info(`  Processed posts: ${stats.total}`);
  }
}
