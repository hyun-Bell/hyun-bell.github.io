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

/**
 * 프로젝트 로더
 */
export const projectLoader: Loader = {
  name: 'notion-project-loader',

  load: async function ({ store, logger, parseData, generateDigest }) {
    logger.info('Loading projects from Notion...');

    try {
      const client = getNotionClient();
      const projects = await client.getProjects();

      // 프로젝트는 수가 적으므로 전체 교체 방식 사용
      store.clear();

      for (const project of projects) {
        const projectData: Record<string, unknown> = {
          id: project.id,
          name: project.name,
          description: project.description,
          status: project.status,
          techStack: project.techStack,
          githubUrl: project.githubUrl,
          liveUrl: project.liveUrl,
          startDate: project.startDate?.toISOString(),
          endDate: project.endDate?.toISOString(),
          content: project.content,
        };

        const data = await parseData({
          id: project.id,
          data: projectData,
        });

        store.set({
          id: project.id,
          data,
          digest: generateDigest(projectData),
        });
      }

      logger.info(`Loaded ${projects.length} projects`);
    } catch (error) {
      logError(error, 'projectLoader');
      logger.error('Failed to load projects from Notion');
      // 프로젝트 로드 실패는 치명적이지 않으므로 에러를 throw하지 않음
    }
  },

  schema: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    status: z.enum(['In Progress', 'Completed', 'Planned']),
    techStack: z.array(z.string()),
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

  load: async function ({ store, logger, parseData, generateDigest }) {
    logger.info('Loading code snippets from Notion...');

    try {
      const client = getNotionClient();
      const snippets = await client.getSnippets();

      // 각 스니펫의 코드 콘텐츠 가져오기
      const snippetsWithCode = await Promise.all(
        snippets.map(async (snippet) => {
          try {
            const code = await client.getPageContent(snippet.id);
            return { ...snippet, code };
          } catch (error) {
            logError(error, `Failed to fetch snippet content: ${snippet.id}`);
            return snippet;
          }
        }),
      );

      // 스니펫도 전체 교체 방식
      store.clear();

      for (const snippet of snippetsWithCode) {
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
          digest: generateDigest(snippetData),
        });
      }

      logger.info(`Loaded ${snippetsWithCode.length} snippets`);
    } catch (error) {
      logError(error, 'snippetLoader');
      logger.error('Failed to load snippets from Notion');
    }
  },

  schema: z.object({
    id: z.string(),
    title: z.string(),
    language: z.string().optional(),
    tags: z.array(z.string()),
    description: z.string().optional(),
    code: z.string().optional(),
  }),
};
