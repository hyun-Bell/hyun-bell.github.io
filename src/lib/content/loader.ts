/**
 * Astro Content Collection 로더
 * Notion 데이터를 Astro Content로 변환
 */

import type { Loader } from 'astro/loaders';
import { z } from 'astro:content';
import { getNotionClient } from '@/lib/notion/client';
import { logError } from '@/lib/utils/errors';
// TODO: 실제 구현 시 사용할 타입들
// import type { BlogPost, Project, Snippet } from '@/lib/types/notion';

/**
 * 블로그 포스트 로더
 */
export const blogLoader: Loader = {
  name: 'notion-blog-loader',
  load: async function ({ store: _store, logger, parseData: _parseData }) {
    logger.info('Loading blog posts from Notion...');

    try {
      const client = getNotionClient();
      const posts = await client.getBlogPosts();

      // TODO: Notion 데이터를 BlogPost 타입으로 변환
      // TODO: store에 저장

      logger.info(`Loaded ${posts.length} blog posts`);
    } catch (error) {
      logError(error, 'blogLoader');
      logger.error('Failed to load blog posts from Notion');
    }
  },
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    slug: z.string(),
    published: z.boolean().default(false),
    publishDate: z.date(),
    lastModified: z.date(),
    tags: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    author: z.string().optional(),
  }),
};

/**
 * 프로젝트 로더
 */
export const projectLoader: Loader = {
  name: 'notion-project-loader',
  load: async function ({ store: _store, logger }) {
    logger.info('Loading projects from Notion...');

    try {
      const client = getNotionClient();
      const projects = await client.getProjects();

      // TODO: 구현

      logger.info(`Loaded ${projects.length} projects`);
    } catch (error) {
      logError(error, 'projectLoader');
      logger.error('Failed to load projects from Notion');
    }
  },
  schema: z.object({
    name: z.string(),
    description: z.string(),
    status: z.enum(['In Progress', 'Completed', 'Planned']),
    techStack: z.array(z.string()).default([]),
    githubUrl: z.string().url().optional(),
    liveUrl: z.string().url().optional(),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
  }),
};

/**
 * 코드 스니펫 로더
 */
export const snippetLoader: Loader = {
  name: 'notion-snippet-loader',
  load: async function ({ logger }) {
    logger.info('Loading snippets from Notion...');

    try {
      const client = getNotionClient();
      const snippets = await client.getSnippets();

      // TODO: 구현

      logger.info(`Loaded ${snippets.length} snippets`);
    } catch (error) {
      logError(error, 'snippetLoader');
      logger.error('Failed to load snippets from Notion');
    }
  },
  schema: z.object({
    title: z.string(),
    language: z.string().optional(),
    tags: z.array(z.string()).default([]),
    description: z.string().optional(),
    code: z.string().optional(),
  }),
};
