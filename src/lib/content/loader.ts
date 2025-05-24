import type { BlogPost, Project, Snippet } from '@/lib/types/notion'; /**
 * Astro Content Collection 로더
 * Notion 데이터를 Astro Content로 변환
 */

import type { Loader } from 'astro/loaders';
import { z } from 'astro:content';
import { getNotionClient } from '@/lib/notion/client';
import { logError } from '@/lib/utils/errors';
import { cache } from '@/lib/utils/cache';

/**
 * 블로그 포스트 로더
 */
export const blogLoader: Loader = {
  name: 'notion-blog-loader',
  load: async function ({ store, logger, parseData, generateDigest }) {
    logger.info('Loading blog posts from Notion...');

    try {
      const client = getNotionClient();

      // 캐시 확인
      const cacheKey = 'blog-posts';
      const cachedPosts = await cache.get<BlogPost[]>('notion', cacheKey);

      let posts;
      if (cachedPosts) {
        logger.info('Using cached blog posts');
        posts = cachedPosts;
      } else {
        logger.info('Fetching blog posts from Notion API');
        posts = await client.getBlogPosts();

        // 캐시 저장
        await cache.set('notion', cacheKey, posts);
      }

      // Store에 저장
      for (const post of posts) {
        const id = post.slug;
        const data = await parseData({
          id: post.slug,
          data: {
            ...post,
            // Date 객체를 문자열로 변환 (Astro 요구사항)
            publishDate: post.publishDate.toISOString(),
            lastModified: post.lastModified.toISOString(),
          },
        });
        const digest = generateDigest(data);

        store.set({ id, data, digest });
      }

      logger.info(`Loaded ${posts.length} blog posts`);
    } catch (error) {
      logError(error, 'blogLoader');
      logger.error('Failed to load blog posts from Notion');
      throw error;
    }
  },
  schema: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    slug: z.string(),
    published: z.boolean().default(false),
    publishDate: z.string().transform((str) => new Date(str)),
    lastModified: z.string().transform((str) => new Date(str)),
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
  load: async function ({ store, logger, parseData, generateDigest }) {
    logger.info('Loading projects from Notion...');

    try {
      const client = getNotionClient();

      // 캐시 확인
      const cacheKey = 'projects';
      const cachedProjects = await cache.get<Project[]>('notion', cacheKey);

      let projects;
      if (cachedProjects) {
        logger.info('Using cached projects');
        projects = cachedProjects;
      } else {
        logger.info('Fetching projects from Notion API');
        projects = await client.getProjects();

        // 캐시 저장
        await cache.set('notion', cacheKey, projects);
      }

      // Store에 저장
      for (const project of projects) {
        const id = project.id;
        const data = await parseData({
          id: project.id,
          data: {
            ...project,
            startDate: project.startDate?.toISOString(),
            endDate: project.endDate?.toISOString(),
          },
        });
        const digest = generateDigest(data);

        store.set({ id, data, digest });
      }

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
  load: async function ({ store, logger, parseData, generateDigest }) {
    logger.info('Loading snippets from Notion...');

    try {
      const client = getNotionClient();

      // 캐시 확인
      const cacheKey = 'snippets';
      const cachedSnippets = await cache.get<Snippet[]>('notion', cacheKey);

      let snippets;
      if (cachedSnippets) {
        logger.info('Using cached snippets');
        snippets = cachedSnippets;
      } else {
        logger.info('Fetching snippets from Notion API');
        snippets = await client.getSnippets();

        // 스니펫의 코드 콘텐츠 가져오기
        for (const snippet of snippets) {
          try {
            const content = await client.getPageContent(snippet.id);
            snippet.code = content;
          } catch (error) {
            logError(error, `getSnippetContent ${snippet.id}`);
          }
        }

        // 캐시 저장
        await cache.set('notion', cacheKey, snippets);
      }

      // Store에 저장
      for (const snippet of snippets) {
        const id = snippet.id;
        const data = await parseData({
          id: snippet.id,
          data: { ...snippet },
        });
        const digest = generateDigest(data);

        store.set({ id, data, digest });
      }

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

/**
 * 캐시 클리어 헬퍼
 */
export async function clearNotionCache(): Promise<void> {
  await cache.clearNamespace('notion');
}
