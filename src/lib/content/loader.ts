/**
 * Astro Content Collection 로더
 */

import { getNotionClient } from '@/lib/notion/client';
import { logError } from '@/lib/utils/errors';
import type { Loader } from 'astro/loaders';
import { z } from 'astro:content';

/**
 * 블로그 포스트 로더
 * Digest 기반 증분 업데이트로 변경된 콘텐츠만 가져옴
 */
export const blogLoader: Loader = {
  name: 'notion-blog-loader',

  load: async function ({ store, logger, parseData, generateDigest }) {
    const client = getNotionClient();

    logger.info('Checking for content updates...');

    try {
      // 1. 포스트 요약 정보 가져오기 (메타데이터만)
      const summaries = await client.getPostSummaries();
      logger.info(`Found ${summaries.length} published posts in Notion`);

      const processedIds = new Set<string>();
      let updatedCount = 0;
      let skippedCount = 0;

      // 2. 각 포스트 처리
      for (const summary of summaries) {
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
          skippedCount++;
          continue;
        }

        // 변경된 포스트의 전체 콘텐츠 가져오기
        logger.info(`Fetching updated content: ${summary.title}`);

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

          if (wasUpdated) {
            updatedCount++;
          }
        } catch (error) {
          logError(error, `Failed to fetch post: ${summary.id}`);
          // 개별 포스트 실패가 전체 프로세스를 중단하지 않도록
          continue;
        }
      }

      // 3. 삭제된 포스트 처리
      let deletedCount = 0;
      for (const existingId of store.keys()) {
        if (!processedIds.has(existingId)) {
          store.delete(existingId);
          deletedCount++;
          logger.info(`Removed deleted post: ${existingId}`);
        }
      }

      // 4. 동기화 완료 로그
      logger.info(
        `Sync completed: ${updatedCount} updated, ${skippedCount} unchanged, ${deletedCount} deleted`,
      );
    } catch (error) {
      logError(error, 'blogLoader');
      logger.error('Failed to sync with Notion');
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
