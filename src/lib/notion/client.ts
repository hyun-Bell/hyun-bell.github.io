/**
 * Notion 클라이언트 구현
 */

import type { BlogPost } from '@/lib/types/notion';
import type { NotionRichText } from '@/lib/types/notion-blocks';
import { env } from '@/lib/utils/env';
import { logError, NotionError, retry } from '@/lib/utils/errors';
import { calculateReadingTime } from '@/lib/utils/strings';
import { Client, isFullPage } from '@notionhq/client';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { NotionToMarkdown } from 'notion-to-md';
import { convertMarkdownImages, convertToPublicNotionImage } from './image-utils';

export interface PostSummary {
  id: string;
  slug: string;
  title: string;
  lastModified: string;
  published: boolean;
}

export class NotionClient {
  private client: Client;
  private n2m: NotionToMarkdown;

  constructor() {
    this.client = new Client({
      auth: env.NOTION_TOKEN(),
    });

    this.n2m = new NotionToMarkdown({
      notionClient: this.client,
    });

    // 커스텀 변환 규칙 설정
    this.setupCustomTransformers();
  }

  /**
   * 포스트 요약 정보만 가져오기 (빠름)
   * 증분 업데이트를 위한 메타데이터만 조회
   */
  async getPostSummaries(): Promise<PostSummary[]> {
    try {
      const databaseId = env.NOTION_DATABASE_ID();

      const response = await retry(
        () =>
          this.client.databases.query({
            database_id: databaseId,
            page_size: 100,
            sorts: [
              {
                timestamp: 'last_edited_time',
                direction: 'descending',
              },
            ],
          }),
        {
          maxAttempts: 3,
          delay: 1000,
          onRetry: (error, attempt) => {
            logError(error, `getPostSummaries retry ${attempt}`);
          },
        },
      );

      const summaries: PostSummary[] = [];

      for (const page of response.results) {
        if (!isFullPage(page)) continue;

        try {
          // Published 체크
          const published =
            this.getCheckbox(page.properties.Published) ||
            this.getCheckbox(page.properties.게시) ||
            false;

          if (!published) {
            continue; // 게시되지 않은 포스트는 건너뛰기
          }

          const title = this.getTitle(page.properties) || 'Untitled';
          const slug = page.id.replace(/-/g, '');

          summaries.push({
            id: page.id,
            slug,
            title,
            lastModified: page.last_edited_time,
            published,
          });
        } catch (error) {
          logError(error, `transformSummary ${page.id}`);
        }
      }

      return summaries;
    } catch (error) {
      throw new NotionError('Failed to fetch post summaries', 'FETCH_SUMMARIES_ERROR');
    }
  }

  /**
   * 개별 포스트 전체 콘텐츠 가져오기
   */
  async getFullPost(pageId: string): Promise<BlogPost> {
    try {
      // 페이지 정보 가져오기
      const page = await retry(() => this.client.pages.retrieve({ page_id: pageId }), {
        maxAttempts: 3,
        delay: 1000,
      });

      if (!isFullPage(page)) {
        throw new NotionError(`Page ${pageId} is not a full page`, 'INVALID_PAGE');
      }

      // 콘텐츠 가져오기
      const content = await this.getPageContent(pageId);

      // BlogPost로 변환
      const post = await this.transformBlogPost(page as PageObjectResponse);
      post.content = content;
      post.readingTime = calculateReadingTime(content);

      return post;
    } catch (error) {
      throw new NotionError(`Failed to fetch full post: ${pageId}`, 'FETCH_POST_ERROR');
    }
  }

  /**
   * 블로그 포스트 목록 가져오기
   */
  async getBlogPosts(): Promise<BlogPost[]> {
    try {
      const databaseId = env.NOTION_DATABASE_ID();

      const response = await retry(
        () =>
          this.client.databases.query({
            database_id: databaseId,
          }),
        {
          maxAttempts: 3,
          delay: 1000,
          onRetry: (error, attempt) => {
            logError(error, `getBlogPosts retry ${attempt}`);
          },
        },
      );

      if (import.meta.env.DEV) {
        console.warn('Notion API response:', {
          resultsCount: response.results.length,
          hasMore: response.has_more,
        });
      }

      const posts: BlogPost[] = [];

      for (const page of response.results) {
        if (!isFullPage(page)) continue;

        try {
          const post = await this.transformBlogPost(page as PageObjectResponse);
          posts.push(post);

          if (import.meta.env.DEV) {
            console.warn('Transformed post:', {
              title: post.title,
              published: post.published,
              slug: post.slug,
            });
          }
        } catch (error) {
          logError(error, `transformBlogPost ${page.id}`);
        }
      }

      // Published가 true인 포스트만 필터링
      const publishedPosts = posts.filter((post) => post.published);

      if (import.meta.env.DEV) {
        console.warn(
          `Filtered posts: ${publishedPosts.length} published out of ${posts.length} total`,
        );
      }

      // JavaScript로 날짜순 정렬
      publishedPosts.sort((a, b) => b.publishDate.getTime() - a.publishDate.getTime());

      return publishedPosts;
    } catch (error) {
      throw new NotionError('Failed to fetch blog posts', 'FETCH_POSTS_ERROR');
    }
  }

  /**
   * 페이지 콘텐츠 가져오기
   */
  async getPageContent(pageId: string): Promise<string> {
    try {
      const mdblocks = await this.n2m.pageToMarkdown(pageId);
      const mdString = this.n2m.toMarkdownString(mdblocks);
      let content = mdString.parent || '';

      // 남은 이미지 URL 변환 (인라인 이미지 등)
      content = convertMarkdownImages(content, pageId);

      return content;
    } catch (error) {
      throw new NotionError(`Failed to fetch page content: ${pageId}`, 'FETCH_CONTENT_ERROR');
    }
  }


  /**
   * 블로그 포스트 변환
   */
  private async transformBlogPost(page: PageObjectResponse): Promise<BlogPost> {
    const props = page.properties;

    // 제목 추출 - 전체 properties 객체 전달
    const title = this.getTitle(props) || 'Untitled';

    // ID를 slug로 사용 (하이픈 제거하여 더 깔끔하게)
    const slug = page.id.replace(/-/g, '');

    // 날짜 처리 - 다양한 날짜 속성 이름 시도
    const dateValue =
      this.getDate(props.PublishDate) ||
      this.getDate(props.PublishedDate) ||
      this.getDate(props.Date) ||
      this.getDate(props.날짜);

    const publishDate = dateValue ? new Date(dateValue) : new Date(page.created_time);

    // 콘텐츠 가져오기
    const content = await this.getPageContent(page.id);

    // 작성자 - 다양한 속성 이름 시도
    const authorValue =
      this.getRichText(props.Author) || this.getRichText(props.작성자) || env.PUBLIC_AUTHOR_NAME();

    // Published 상태 - 다양한 속성 이름 시도
    const published = this.getCheckbox(props.Published) || this.getCheckbox(props.게시) || false;

    // Featured 상태
    const featured = this.getCheckbox(props.Featured) || this.getCheckbox(props.추천) || false;

    // Tags - 다양한 속성 이름 시도
    const tags = this.getMultiSelect(props.Tags) || this.getMultiSelect(props.태그) || [];

    return {
      id: page.id,
      title,
      description: this.getRichText(props.Description) || this.getRichText(props.설명) || undefined,
      slug,
      published,
      publishDate,
      lastModified: new Date(page.last_edited_time),
      tags,
      featured,
      author: authorValue || 'Anonymous',
      content,
      readingTime: calculateReadingTime(content),
    };
  }

  /**
   * 커스텀 변환 규칙 설정
   */
  private setupCustomTransformers(): void {
    // 코드 블록 변환 개선
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.n2m.setCustomTransformer('code', async (block: any) => {
      try {
        if (!block.code) return '';

        const code = block.code.rich_text.map((text: NotionRichText) => text.plain_text).join('');
        const language = block.code.language || 'plaintext';

        return `\`\`\`${language}\n${code}\n\`\`\``;
      } catch (error) {
        console.error('Code block transform error:', error);
        return '';
      }
    });

    // 이미지 블록 변환
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.n2m.setCustomTransformer('image', async (block: any) => {
      try {
        if (!block.image) return '';

        const image = block.image;
        let src = '';

        if (image.type === 'external' && image.external) {
          src = image.external.url;
        } else if (image.type === 'file' && image.file) {
          // Notion 내부 이미지를 공개 URL로 변환
          src = convertToPublicNotionImage(image.file.url, block.id);
        }

        if (!src) {
          console.warn('No image URL found in block:', block.id);
          return '';
        }

        // 캡션 처리
        const caption = image.caption.map((text: NotionRichText) => text.plain_text).join('');

        // 이미지 태그에 블록 ID 포함
        const imgTag = `<img src="${src}" alt="${caption}" data-block-id="${block.id}" loading="lazy" />`;

        return caption
          ? `<figure class="blog-figure">${imgTag}<figcaption>${caption}</figcaption></figure>`
          : imgTag;
      } catch (error) {
        console.error('Image transform error:', error);
        return '';
      }
    });

    // 북마크 블록 변환
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.n2m.setCustomTransformer('bookmark', async (block: any) => {
      try {
        if (!block.bookmark) return '';

        const url = block.bookmark.url;
        const caption =
          block.bookmark.caption?.map((text: NotionRichText) => text.plain_text).join('') || url;

        return `[${caption}](${url})`;
      } catch (error) {
        console.error('Bookmark transform error:', error);
        return '';
      }
    });
  }

  // Property 헬퍼 함수들 - 더 유연한 속성 접근
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getTitle(props: any): string | null {
    // 다양한 제목 속성 이름 시도
    const titleProps = ['Title', 'Name', '제목', 'title', 'name'];

    for (const titleProp of titleProps) {
      if (props[titleProp]?.title?.[0]?.plain_text) {
        return props[titleProp].title[0].plain_text;
      }
    }

    // 첫 번째 title 타입 속성 찾기
    for (const key in props) {
      if (props[key]?.title?.[0]?.plain_text) {
        return props[key].title[0].plain_text;
      }
    }

    return null;
  }

  private getRichText(prop: unknown): string | null {
    if (prop && typeof prop === 'object' && 'rich_text' in prop) {
      const richTextProp = prop as { rich_text: Array<{ plain_text: string }> };
      return richTextProp.rich_text?.[0]?.plain_text || null;
    }
    return null;
  }

  private getCheckbox(prop: unknown): boolean {
    if (prop && typeof prop === 'object' && 'checkbox' in prop) {
      const checkboxProp = prop as { checkbox: boolean };
      return checkboxProp.checkbox || false;
    }
    return false;
  }

  private getDate(prop: unknown): string | null {
    if (prop && typeof prop === 'object' && 'date' in prop) {
      const dateProp = prop as { date: { start: string } | null };
      return dateProp.date?.start || null;
    }
    return null;
  }

  private getMultiSelect(prop: unknown): string[] {
    if (prop && typeof prop === 'object' && 'multi_select' in prop) {
      const multiSelectProp = prop as { multi_select: Array<{ name: string }> };
      return multiSelectProp.multi_select?.map((item) => item.name) || [];
    }
    return [];
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
