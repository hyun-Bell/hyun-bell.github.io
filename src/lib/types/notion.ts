/**
 * Notion API 관련 타입 정의
 */

export interface NotionPage {
  id: string;
  created_time: string;
  last_edited_time: string;
  archived: boolean;
  properties: Record<string, unknown>;
}

export interface ImageInfo {
  url: string;
  alt: string;
  width: number;
  height: number;
  caption: string;
  blurDataURL: string;
}

// 블로그 포스트 속성
export interface NotionBlogPost extends NotionPage {
  properties: {
    Title: {
      title: Array<{
        plain_text: string;
      }>;
    };
    Description?: {
      rich_text: Array<{
        plain_text: string;
      }>;
    };
    Published: {
      checkbox: boolean;
    };
    PublishDate: {
      date: {
        start: string;
      } | null;
    };
    Tags: {
      multi_select: Array<{
        name: string;
        color: string;
      }>;
    };
    Featured: {
      checkbox: boolean;
    };
    Slug: {
      rich_text: Array<{
        plain_text: string;
      }>;
    };
    Author?: {
      rich_text: Array<{
        plain_text: string;
      }>;
    };
  };
}

// 블록 타입 정의
export type NotionBlock = {
  id: string;
  type: string;
  has_children: boolean;
  [key: string]: unknown;
};

// 컨텐츠 타입
export interface BlogPost {
  id: string;
  title: string;
  description?: string | undefined;
  slug: string;
  published: boolean;
  publishDate: Date;
  lastModified: Date;
  tags: string[];
  featured: boolean;
  author?: string | undefined;
  content?: string | undefined; // HTML로 변환된 컨텐츠
  readingTime?: number | undefined; // 읽기 시간 (분)
  images?: ImageInfo[];
}
