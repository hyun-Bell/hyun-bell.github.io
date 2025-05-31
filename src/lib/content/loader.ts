/**
 * Astro Content Collection 로더
 */

import { getNotionClient } from '@/lib/notion/client';
import { logError } from '@/lib/utils/errors';
import type { Loader } from 'astro/loaders';
import { z } from 'astro:content';

const BATCH_SIZE = 5; // 동시에 처리할 포스트 수

/**
 * 블로그 포스트 로더
 * Digest 기반 증분 업데이트로 변경된 콘텐츠만 가져옴
 */
export const blogLoader: Loader = {
  name: 'notion-blog-loader',

  load: async function ({ store, logger, parseData, generateDigest }) {
    const client = getNotionClient();
    const startTime = Date.now();

    logger.info('🚀 Starting Notion content sync...');

    try {
      // 포스트 요약 정보 가져오기 (메타데이터만)
      const summaries = await client.getPostSummaries();
      logger.info(`📊 Found ${summaries.length} published posts in Notion`);

      const processedIds = new Set<string>();
      let updatedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      const batches = createBatches(summaries, BATCH_SIZE);
      logger.info(`🔄 Processing ${batches.length} batches (${BATCH_SIZE} posts per batch)`);

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];

        if (!batch) {
          logger.warn(`⚠️ Batch ${batchIndex} is undefined, skipping`);
          continue;
        }

        const batchStartTime = Date.now();

        logger.info(
          `📦 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} posts)`,
        );

        // 배치 내 포스트들을 병렬로 처리
        const batchResults = await Promise.allSettled(
          batch.map(async (summary) => {
            processedIds.add(summary.slug);

            // 콘텐츠 식별을 위한 digest 생성
            const digest = generateDigest({
              lastModified: summary.lastModified,
              title: summary.title,
            });

            // 기존 엔트리와 비교
            const existingEntry = store.get(summary.slug);

            // digest가 같으면 변경 없음 - 스킵
            if (existingEntry && existingEntry.digest === digest) {
              return { type: 'skipped' as const, summary };
            }

            // 변경된 포스트의 전체 콘텐츠 가져오기
            try {
              const fullPost = await client.getFullPost(summary.id);

              // Astro의 parseData를 위한 타입 변환
              const postData: Record<string, unknown> = {
                id: fullPost.id,
                title: fullPost.title,
                description: fullPost.description,
                slug: fullPost.slug,
                published: fullPost.published,
                publishDate: fullPost.publishDate.toISOString(),
                lastModified: fullPost.lastModified.toISOString(),
                tags: fullPost.tags,
                featured: fullPost.featured,
                author: fullPost.author,
                content: fullPost.content,
                readingTime: fullPost.readingTime,
              };

              const data = await parseData({
                id: fullPost.slug,
                data: postData,
              });

              // store에 저장 - Astro가 자동으로 캐싱 관리
              const wasUpdated = store.set({
                id: fullPost.slug,
                data,
                digest,
              });

              return {
                type: wasUpdated ? ('updated' as const) : ('unchanged' as const),
                summary,
              };
            } catch (error) {
              logError(error, `Failed to fetch post: ${summary.id}`);
              return { type: 'error' as const, summary, error };
            }
          }),
        );

        // 배치 결과 집계
        batchResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            switch (result.value.type) {
              case 'updated':
                updatedCount++;
                logger.info(`✅ Updated: ${result.value.summary.title}`);
                break;
              case 'skipped':
                skippedCount++;
                break;
              case 'error':
                errorCount++;
                logger.error(`❌ Error: ${result.value.summary.title}`);
                break;
            }
          } else {
            errorCount++;
            logger.error(`❌ Unexpected error: ${result.reason}`);
          }
        });

        const batchTime = ((Date.now() - batchStartTime) / 1000).toFixed(2);
        logger.info(`⏱️  Batch ${batchIndex + 1} completed in ${batchTime}s`);

        // 다음 배치 전 짧은 지연 (Rate limiting 방지)
        if (batchIndex < batches.length - 1) {
          await delay(100);
        }
      }

      // 삭제된 포스트 처리
      let deletedCount = 0;
      for (const existingId of store.keys()) {
        if (!processedIds.has(existingId)) {
          store.delete(existingId);
          deletedCount++;
          logger.info(`🗑️  Removed deleted post: ${existingId}`);
        }
      }

      // 동기화 완료 통계
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
      const stats = {
        total: summaries.length,
        updated: updatedCount,
        skipped: skippedCount,
        deleted: deletedCount,
        errors: errorCount,
        duration: totalTime,
      };

      logger.info('📊 Sync Summary:');
      logger.info(`  ✅ Updated: ${stats.updated}`);
      logger.info(`  ⏭️  Skipped: ${stats.skipped}`);
      logger.info(`  🗑️  Deleted: ${stats.deleted}`);
      logger.info(`  ❌ Errors: ${stats.errors}`);
      logger.info(`  ⏱️  Total time: ${stats.duration}s`);
      logger.info(`  📈 Avg per post: ${(parseFloat(stats.duration) / stats.total).toFixed(3)}s`);

      if (import.meta.env.DEV) {
        console.log('Sync metadata:', {
          lastSync: new Date().toISOString(),
          stats,
        });
      }
    } catch (error) {
      logError(error, 'blogLoader');
      logger.error('❌ Failed to sync with Notion');
      throw error;
    }
  },

  schema: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    slug: z.string(),
    published: z.boolean(),
    publishDate: z.string().transform((str) => new Date(str)),
    lastModified: z.string().transform((str) => new Date(str)),
    tags: z.array(z.string()),
    featured: z.boolean(),
    author: z.string().optional(),
    content: z.string().optional(),
    readingTime: z.number().optional(),
  }),
};

/**
 * 배열을 배치로 분할
 */
function createBatches<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Promise 기반 지연 함수
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
