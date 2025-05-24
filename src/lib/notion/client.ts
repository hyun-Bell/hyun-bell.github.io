/**
 * Notion 클라이언트 설정
 * 실제 구현은 다음 단계에서 진행
 */

// import { env } from '@/lib/utils/env';
// import { NotionError, retry } from '@/lib/utils/errors';
import type { NotionBlogPost, NotionProject, NotionSnippet } from '@/lib/types/notion';

// Notion SDK는 다음 단계에서 설치 예정
// import { Client } from '@notionhq/client';

export class NotionClient {
  // private client: Client;

  constructor() {
    // TODO: Notion SDK 초기화
    // this.client = new Client({
    //   auth: env.NOTION_TOKEN(),
    // });
  }

  /**
   * 블로그 포스트 목록 가져오기
   */
  async getBlogPosts(): Promise<NotionBlogPost[]> {
    // TODO: 구현 예정
    return [];
  }

  /**
   * 프로젝트 목록 가져오기
   */
  async getProjects(): Promise<NotionProject[]> {
    // TODO: 구현 예정
    return [];
  }

  /**
   * 코드 스니펫 목록 가져오기
   */
  async getSnippets(): Promise<NotionSnippet[]> {
    // TODO: 구현 예정
    return [];
  }

  /**
   * 페이지 콘텐츠 가져오기
   */
  async getPageContent(_pageId: string): Promise<string> {
    // TODO: 구현 예정
    return '';
  }
}

// 싱글톤 인스턴스
let notionClient: NotionClient | null = null;

export function getNotionClient(): NotionClient {
  if (!notionClient) {
    notionClient = new NotionClient();
  }
  return notionClient;
}
