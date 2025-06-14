import { defineCollection, z } from 'astro:content';
import { blogLoader } from '@/lib/content/loader';

const imageSchema = z.object({
  url: z.string(),
  alt: z.string(),
  width: z.number(),
  height: z.number(),
  caption: z.string().optional(),
  blurDataURL: z.string().optional(),
});

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
  images: z.array(imageSchema).optional(),
});

const blog = defineCollection({
  loader: blogLoader,
  schema: blogSchema,
});

export const collections = {
  blog,
};

export type BlogPost = z.infer<typeof blogSchema>;
export type ImageInfo = z.infer<typeof imageSchema>;
