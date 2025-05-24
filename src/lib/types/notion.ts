/**
 * Notion API 관련 타입 정의
 */

// Notion Page 기본 속성
export interface NotionPage {
  id: string;
  created_time: string;
  last_edited_time: string;
  archived: boolean;
  properties: Record<string, unknown>;
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

// 프로젝트 속성
export interface NotionProject extends NotionPage {
  properties: {
    Name: {
      title: Array<{
        plain_text: string;
      }>;
    };
    Description: {
      rich_text: Array<{
        plain_text: string;
      }>;
    };
    Status: {
      select: {
        name: 'In Progress' | 'Completed' | 'Planned';
        color: string;
      } | null;
    };
    TechStack: {
      multi_select: Array<{
        name: string;
        color: string;
      }>;
    };
    GitHubURL?: {
      url: string | null;
    };
    LiveURL?: {
      url: string | null;
    };
    StartDate?: {
      date: {
        start: string;
      } | null;
    };
    EndDate?: {
      date: {
        start: string;
      } | null;
    };
  };
}

// 코드 스니펫 속성
export interface NotionSnippet extends NotionPage {
  properties: {
    Title: {
      title: Array<{
        plain_text: string;
      }>;
    };
    Language: {
      select: {
        name: string;
        color: string;
      } | null;
    };
    Tags: {
      multi_select: Array<{
        name: string;
        color: string;
      }>;
    };
    Description?: {
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
  description?: string;
  slug: string;
  published: boolean;
  publishDate: Date;
  lastModified: Date;
  tags: string[];
  featured: boolean;
  author?: string;
  content?: string; // HTML로 변환된 컨텐츠
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'In Progress' | 'Completed' | 'Planned';
  techStack: string[];
  githubUrl?: string;
  liveUrl?: string;
  startDate?: Date;
  endDate?: Date;
  content?: string;
}

export interface Snippet {
  id: string;
  title: string;
  language?: string;
  tags: string[];
  description?: string;
  code?: string;
}
