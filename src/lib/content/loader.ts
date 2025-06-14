import { getNotionClient } from '@/lib/notion/client';
import { logError, retry } from '@/lib/utils/errors';
import type { ImageInfo } from '@/lib/types/notion';
import { extractMultipleImageDimensions } from '@/lib/image/dimensions';
import type { BlogPost } from '@/lib/types/notion';
import type { NotionClient, PostSummary } from '@/lib/notion/client';
// Astro v5 Content Loader API 타입 정의
interface DataEntry {
  id: string;
  data: unknown;
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

const CONCURRENT_POST_PROCESSING_LIMIT = 3;
const RATE_LIMITING_DELAY_MS = 500;

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

      const postBatches = createConcurrentBatches(
        publishedPostSummaries,
        CONCURRENT_POST_PROCESSING_LIMIT,
      );
      logger.info(
        `🔄 Processing ${postBatches.length} batches (${CONCURRENT_POST_PROCESSING_LIMIT} posts per batch)`,
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
          await delay(RATE_LIMITING_DELAY_MS);
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

  const imageUrls = imageMatches.map((match) => match.url);
  const imageDimensionsMap = await extractMultipleImageDimensions(imageUrls, 3);

  return createImageInfoList(imageMatches, imageDimensionsMap);
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
  const DEFAULT_DIMENSIONS = { width: 1200, height: 900 };

  return imageMatches.map(({ url, alt }) => {
    const imageDimensions = dimensionsMap.get(url) || DEFAULT_DIMENSIONS;

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
  const normalizedModificationTime = new Date(postSummary.lastModified);
  normalizedModificationTime.setSeconds(0, 0);

  return generateDigest({
    lastModified: normalizedModificationTime.toISOString(),
    title: postSummary.title.trim(),
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
    const fullPost = await retry(() => client.getFullPost(postSummary.id), {
      maxAttempts: 3,
      delay: 1000,
      backoff: true,
      onRetry: (error, attempt) => {
        if (error.message.includes('429') || error.message.includes('rate')) {
          logger.warn(`🚦 Rate limited for ${postSummary.title}, retrying (${attempt}/3)`);
        }
      },
    });

    const processedImages = fullPost.content
      ? await extractAndProcessImages(fullPost.content).catch(() => [])
      : [];

    if (processedImages.length > 0) {
      logger.info(`Processed ${processedImages.length} images for "${postSummary.title}"`);
    }

    const astroPostData = createAstroPostData(fullPost, processedImages);
    const parsedData = await parseData({ id: fullPost.slug, data: astroPostData });
    const _renderedContent = fullPost.content ? await renderMarkdown(fullPost.content) : undefined;

    store.set({
      id: fullPost.slug,
      data: parsedData,
      digest: contentDigest,
      rendered: _renderedContent,
    });

    return {
      type: 'updated' as const,
      summary: postSummary,
    };
  } catch (error) {
    logError(error, `Failed to fetch post: ${postSummary.id}`);
    return { type: 'error' as const, summary: postSummary, error };
  }
}

function createAstroPostData(
  fullPost: BlogPost,
  processedImages: ImageInfo[],
): Record<string, unknown> {
  return {
    id: fullPost.id,
    title: fullPost.title,
    description: fullPost.description,
    slug: fullPost.slug,
    published: fullPost.published,
    publishDate: fullPost.publishDate,
    lastModified: fullPost.lastModified,
    tags: fullPost.tags,
    featured: fullPost.featured,
    author: fullPost.author,
    content: fullPost.content,
    readingTime: fullPost.readingTime,
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
