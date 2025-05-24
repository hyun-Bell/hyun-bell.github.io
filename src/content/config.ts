// import { defineCollection, z } from 'astro:content';
import { z } from 'astro:content';

// TODO: Notion loader will be implemented in the next step
// defineCollection will be used when implementing collections

// 블로그 포스트 스키마 정의
const blogSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  publishDate: z.date(),
  lastModified: z.date(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
  featured: z.boolean().default(false),
});

// Content collections will be configured when Notion integration is ready
export const collections = {
  // blog: defineCollection({
  //   schema: blogSchema,
  // }),
};

export type BlogPost = z.infer<typeof blogSchema>;
