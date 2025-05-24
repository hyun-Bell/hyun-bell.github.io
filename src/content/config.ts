import { defineCollection, z } from 'astro:content';
import { blogLoader } from '@/lib/content/loader';

// 블로그 포스트 스키마
export const blogSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  slug: z.string(),
  published: z.boolean(),
  publishDate: z.coerce.date(),
  lastModified: z.coerce.date(),
  tags: z.array(z.string()),
  featured: z.boolean(),
  author: z.string().optional(),
  content: z.string().optional(),
  readingTime: z.number().optional(),
});

// 블로그 컬렉션 정의
const blog = defineCollection({
  loader: blogLoader,
  schema: blogSchema,
});

export const collections = {
  blog,
};

// 타입 추출
export type BlogPost = z.infer<typeof blogSchema>;
