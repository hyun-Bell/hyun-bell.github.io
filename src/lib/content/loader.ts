/**
 * Astro Content Collection 로더
 */

import { getNotionClient } from '@/lib/notion/client';
import { logError } from '@/lib/utils/errors';
import type { Loader, LoaderContext } from 'astro/loaders';
import { z } from 'astro:content';

/**
 * 블로그 포스트 로더
 */
export const blogLoader: Loader = {
  name: 'notion-blog-loader',

  load: async function ({ store, logger, parseData, generateDigest, meta }: LoaderContext) {
    const client = getNotionClient();

    // 1. 동기화 간격 설정 (개발: 5분, 프로덕션: 1시간)
    const syncInterval = import.meta.env.DEV ? 5 * 60 * 1000 : 60 * 60 * 1000;
    const lastSyncStr = meta.get('lastSync');
    const lastSync = lastSyncStr ? parseInt(lastSyncStr, 10) : undefined;
    const now = Date.now();

    // 2. 동기화 필요 여부 체크
    if (lastSync && now - lastSync < syncInterval) {
      const ageInSeconds = Math.round((now - lastSync) / 1000);
      logger.info(
        `Using cached data (age: ${ageInSeconds}s, next sync in: ${Math.round((syncInterval - (now - lastSync)) / 1000)}s)`,
      );
      return;
    }

    logger.info('Starting Notion sync...');

    try {
      // 3. 포스트 요약 정보만 먼저 가져오기
      const summaries = await client.getPostSummaries();
      logger.info(`Found ${summaries.length} published posts in Notion`);

      let updatedCount = 0;
      let skippedCount = 0;
      let deletedCount = 0;

      // 4. 각 포스트 처리
      for (const summary of summaries) {
        const existingEntry = store.get(summary.slug);

        // 요약 정보로 digest 생성 (lastModified 기반)
        const summaryDigest = generateDigest({
          lastModified: summary.lastModified,
          title: summary.title,
        });

        // 변경되지 않은 포스트는 건너뛰기
        if (existingEntry && existingEntry.digest === summaryDigest) {
          skippedCount++;
          logger.info(`Skipping unchanged: ${summary.title}`);
          continue;
        }

        // 5. 변경된 포스트만 전체 콘텐츠 가져오기
        logger.info(`Fetching updated post: ${summary.title}`);
        try {
          const fullPost = await client.getFullPost(summary.id);

          // 6. 데이터 검증 및 파싱 - Record<string, unknown>으로 변환
          const postData: Record<string, unknown> = {
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
          };

          const data = await parseData({
            id: fullPost.slug,
            data: postData,
          });

          // 7. Store에 업데이트
          const updated = store.set({
            id: fullPost.slug,
            data,
            digest: summaryDigest, // lastModified 기반 digest 사용
          });

          if (updated) {
            updatedCount++;
          }
        } catch (error) {
          logError(error, `Failed to fetch post: ${summary.id}`);
          // 개별 포스트 실패는 전체 sync를 중단하지 않음
        }
      }

      // 8. 삭제된 포스트 처리
      const currentIds = new Set(summaries.map((s) => s.slug));
      for (const id of store.keys()) {
        if (!currentIds.has(id)) {
          logger.info(`Removing deleted post: ${id}`);
          store.delete(id);
          deletedCount++;
        }
      }

      // 9. 메타데이터 업데이트 - 문자열로 저장
      meta.set('lastSync', now.toString());
      meta.set('postCount', summaries.length.toString());
      meta.set(
        'lastSyncSummary',
        JSON.stringify({
          updated: updatedCount,
          skipped: skippedCount,
          deleted: deletedCount,
          total: summaries.length,
        }),
      );

      logger.info(
        `Sync completed: ${updatedCount} updated, ${skippedCount} skipped, ${deletedCount} deleted`,
      );
    } catch (error) {
      logError(error, 'blogLoader');
      logger.error('Failed to sync with Notion');

      // 에러 시에도 기존 데이터는 유지
      if (store.values().length === 0) {
        // store가 비어있을 때만 폴백
        logger.warn('Store is empty, attempting full fetch...');
        try {
          const posts = await client.getBlogPosts();
          for (const post of posts) {
            // Record<string, unknown>으로 변환
            const postData: Record<string, unknown> = {
              id: post.id,
              title: post.title,
              description: post.description,
              slug: post.slug,
              published: post.published,
              publishDate: post.publishDate,
              lastModified: post.lastModified,
              tags: post.tags,
              featured: post.featured,
              author: post.author,
              content: post.content,
              readingTime: post.readingTime,
            };

            const data = await parseData({
              id: post.slug,
              data: postData,
            });

            store.set({
              id: post.slug,
              data,
              digest: generateDigest({
                lastModified: post.lastModified,
                title: post.title,
              }),
            });
          }
        } catch (fallbackError) {
          logError(fallbackError, 'blogLoader fallback');
          throw fallbackError;
        }
      }
    }
  },

  schema: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    slug: z.string(),
    published: z.boolean().default(false),
    publishDate: z.coerce.date(),
    lastModified: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    author: z.string().optional(),
    content: z.string().optional(),
    readingTime: z.number().optional(),
  }),
};

/**
 * 프로젝트 로더
 */
export const projectLoader: Loader = {
  name: 'notion-project-loader',
  load: async function ({ store, logger, parseData, generateDigest, meta }: LoaderContext) {
    logger.info('Loading projects from Notion...');

    try {
      const client = getNotionClient();

      // 동기화 간격 체크
      const syncInterval = import.meta.env.DEV ? 5 * 60 * 1000 : 60 * 60 * 1000;
      const lastSyncStr = meta.get('lastProjectSync');
      const lastSync = lastSyncStr ? parseInt(lastSyncStr, 10) : undefined;
      const now = Date.now();

      if (lastSync && now - lastSync < syncInterval) {
        logger.info('Using cached projects');
        return;
      }

      const projects = await client.getProjects();

      // Store에 저장
      store.clear(); // 프로젝트는 수가 적으므로 전체 교체

      for (const project of projects) {
        const data = await parseData({
          id: project.id,
          data: {
            ...project,
            startDate: project.startDate?.toISOString(),
            endDate: project.endDate?.toISOString(),
          } as Record<string, unknown>,
        });

        store.set({
          id: project.id,
          data,
          digest: generateDigest(data),
        });
      }

      meta.set('lastProjectSync', now.toString());
      logger.info(`Loaded ${projects.length} projects`);
    } catch (error) {
      logError(error, 'projectLoader');
      logger.error('Failed to load projects from Notion');
    }
  },

  schema: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    status: z.enum(['In Progress', 'Completed', 'Planned']),
    techStack: z.array(z.string()).default([]),
    githubUrl: z.string().url().optional(),
    liveUrl: z.string().url().optional(),
    startDate: z
      .string()
      .transform((str) => (str ? new Date(str) : undefined))
      .optional(),
    endDate: z
      .string()
      .transform((str) => (str ? new Date(str) : undefined))
      .optional(),
    content: z.string().optional(),
  }),
};

/**
 * 코드 스니펫 로더
 */
export const snippetLoader: Loader = {
  name: 'notion-snippet-loader',
  load: async function ({ store, logger, parseData, generateDigest, meta }: LoaderContext) {
    logger.info('Loading snippets from Notion...');

    try {
      const client = getNotionClient();

      // 동기화 간격 체크
      const syncInterval = import.meta.env.DEV ? 5 * 60 * 1000 : 60 * 60 * 1000;
      const lastSyncStr = meta.get('lastSnippetSync');
      const lastSync = lastSyncStr ? parseInt(lastSyncStr, 10) : undefined;
      const now = Date.now();

      if (lastSync && now - lastSync < syncInterval) {
        logger.info('Using cached snippets');
        return;
      }

      const snippets = await client.getSnippets();

      // 스니펫의 코드 콘텐츠 가져오기
      for (const snippet of snippets) {
        try {
          const content = await client.getPageContent(snippet.id);
          snippet.code = content;
        } catch (error) {
          logError(error, `getSnippetContent ${snippet.id}`);
        }
      }

      // Store에 저장
      store.clear();

      for (const snippet of snippets) {
        // Record<string, unknown>으로 변환
        const snippetData: Record<string, unknown> = {
          id: snippet.id,
          title: snippet.title,
          language: snippet.language,
          tags: snippet.tags,
          description: snippet.description,
          code: snippet.code,
        };

        const data = await parseData({
          id: snippet.id,
          data: snippetData,
        });

        store.set({
          id: snippet.id,
          data,
          digest: generateDigest(data),
        });
      }

      meta.set('lastSnippetSync', now.toString());
      logger.info(`Loaded ${snippets.length} snippets`);
    } catch (error) {
      logError(error, 'snippetLoader');
      logger.error('Failed to load snippets from Notion');
    }
  },

  schema: z.object({
    id: z.string(),
    title: z.string(),
    language: z.string().optional(),
    tags: z.array(z.string()).default([]),
    description: z.string().optional(),
    code: z.string().optional(),
  }),
};
