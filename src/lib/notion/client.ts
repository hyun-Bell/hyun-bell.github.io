/**
 * Notion 클라이언트 구현
 */

import type { BlogPost, Project, Snippet } from '@/lib/types/notion';
import { env } from '@/lib/utils/env';
import { logError, NotionError, retry } from '@/lib/utils/errors';
import { calculateReadingTime, slugify } from '@/lib/utils/strings';
import { Client, isFullPage } from '@notionhq/client';
import type {
  PageObjectResponse,
  RichTextItemResponse,
} from '@notionhq/client/build/src/api-endpoints';
import { NotionToMarkdown } from 'notion-to-md';

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
   * 블로그 포스트 목록 가져오기
   */
  async getBlogPosts(): Promise<BlogPost[]> {
    try {
      const databaseId = env.NOTION_DATABASE_ID();

      const response = await retry(
        () =>
          this.client.databases.query({
            database_id: databaseId,
            filter: {
              property: 'Published',
              checkbox: {
                equals: true,
              },
            },
            sorts: [
              {
                property: 'PublishDate',
                direction: 'descending',
              },
            ],
          }),
        {
          maxAttempts: 3,
          delay: 1000,
          onRetry: (error, attempt) => {
            logError(error, `getBlogPosts retry ${attempt}`);
          },
        },
      );

      const posts: BlogPost[] = [];

      for (const page of response.results) {
        if (!isFullPage(page)) continue;

        try {
          const post = await this.transformBlogPost(page as PageObjectResponse);
          posts.push(post);
        } catch (error) {
          logError(error, `transformBlogPost ${page.id}`);
        }
      }

      return posts;
    } catch (error) {
      throw new NotionError('Failed to fetch blog posts', 'FETCH_POSTS_ERROR');
    }
  }

  /**
   * 프로젝트 목록 가져오기
   */
  async getProjects(): Promise<Project[]> {
    try {
      const databaseId = env.NOTION_PROJECTS_DATABASE_ID();
      if (!databaseId) return [];

      const response = await retry(
        () =>
          this.client.databases.query({
            database_id: databaseId,
            sorts: [
              {
                property: 'StartDate',
                direction: 'descending',
              },
            ],
          }),
        { maxAttempts: 3 },
      );

      const projects: Project[] = [];

      for (const page of response.results) {
        if (!isFullPage(page)) continue;

        try {
          const project = await this.transformProject(page as PageObjectResponse);
          projects.push(project);
        } catch (error) {
          logError(error, `transformProject ${page.id}`);
        }
      }

      return projects;
    } catch (error) {
      throw new NotionError('Failed to fetch projects', 'FETCH_PROJECTS_ERROR');
    }
  }

  /**
   * 코드 스니펫 목록 가져오기
   */
  async getSnippets(): Promise<Snippet[]> {
    try {
      const databaseId = env.NOTION_SNIPPETS_DATABASE_ID();
      if (!databaseId) return [];

      const response = await retry(
        () =>
          this.client.databases.query({
            database_id: databaseId,
            sorts: [
              {
                property: 'Title',
                direction: 'ascending',
              },
            ],
          }),
        { maxAttempts: 3 },
      );

      const snippets: Snippet[] = [];

      for (const page of response.results) {
        if (!isFullPage(page)) continue;

        try {
          const snippet = this.transformSnippet(page as PageObjectResponse);
          snippets.push(snippet);
        } catch (error) {
          logError(error, `transformSnippet ${page.id}`);
        }
      }

      return snippets;
    } catch (error) {
      throw new NotionError('Failed to fetch snippets', 'FETCH_SNIPPETS_ERROR');
    }
  }

  /**
   * 페이지 콘텐츠 가져오기
   */
  async getPageContent(pageId: string): Promise<string> {
    try {
      const mdblocks = await this.n2m.pageToMarkdown(pageId);
      const mdString = this.n2m.toMarkdownString(mdblocks);
      return mdString.parent || '';
    } catch (error) {
      throw new NotionError(`Failed to fetch page content: ${pageId}`, 'FETCH_CONTENT_ERROR');
    }
  }

  /**
   * 블로그 포스트 변환
   */
  private async transformBlogPost(page: PageObjectResponse): Promise<BlogPost> {
    const props = page.properties;

    // 제목 추출
    const title = this.getTitle(props.Title) || 'Untitled';

    // Slug 생성
    const customSlug = this.getRichText(props.Slug);
    const slug = customSlug || slugify(title);

    // 날짜 처리
    const publishDate = this.getDate(props.PublishDate)
      ? new Date(this.getDate(props.PublishDate)!)
      : new Date(page.created_time);

    // 콘텐츠 가져오기
    const content = await this.getPageContent(page.id);

    const authorValue = this.getRichText(props.Author) || env.PUBLIC_AUTHOR_NAME();

    return {
      id: page.id,
      title,
      description: this.getRichText(props.Description) || undefined,
      slug,
      published: this.getCheckbox(props.Published) || false,
      publishDate,
      lastModified: new Date(page.last_edited_time),
      tags: this.getMultiSelect(props.Tags) || [],
      featured: this.getCheckbox(props.Featured) || false,
      author: authorValue || 'Anonymous',
      content,
      readingTime: calculateReadingTime(content),
    };
  }

  /**
   * 프로젝트 변환
   */
  private async transformProject(page: PageObjectResponse): Promise<Project> {
    const props = page.properties;

    const name = this.getTitle(props.Name) || 'Untitled';
    const content = await this.getPageContent(page.id);

    return {
      id: page.id,
      name,
      description: this.getRichText(props.Description) || '',
      status: (this.getSelect(props.Status) as Project['status']) || 'Planned',
      techStack: this.getMultiSelect(props.TechStack) || [],
      githubUrl: this.getUrl(props.GitHubURL) || undefined,
      liveUrl: this.getUrl(props.LiveURL) || undefined,
      startDate: this.getDate(props.StartDate)
        ? new Date(this.getDate(props.StartDate)!)
        : undefined,
      endDate: this.getDate(props.EndDate) ? new Date(this.getDate(props.EndDate)!) : undefined,
      content,
    };
  }

  /**
   * 코드 스니펫 변환
   */
  private transformSnippet(page: PageObjectResponse): Snippet {
    const props = page.properties;

    return {
      id: page.id,
      title: this.getTitle(props.Title) || 'Untitled',
      language: this.getSelect(props.Language) || undefined,
      tags: this.getMultiSelect(props.Tags) || [],
      description: this.getRichText(props.Description) || undefined,
    };
  }

  /**
   * 커스텀 변환 규칙 설정
   */
  private setupCustomTransformers(): void {
    // 코드 블록 변환 개선
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.n2m.setCustomTransformer('code', async (block: any) => {
      if ('code' in block && block.code) {
        const code = block.code.rich_text
          .map((text: RichTextItemResponse) => text.plain_text)
          .join('');
        const language = block.code.language || 'plaintext';

        return `\`\`\`${language}\n${code}\n\`\`\``;
      }
      return '';
    });

    // 이미지 블록 변환
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.n2m.setCustomTransformer('image', async (block: any) => {
      if ('image' in block && block.image) {
        const image = block.image;
        const src =
          image.type === 'external'
            ? image.external.url
            : image.type === 'file'
              ? image.file.url
              : '';
        const caption = image.caption.map((text: RichTextItemResponse) => text.plain_text).join('');

        return caption ? `![${caption}](${src})\n*${caption}*` : `![](${src})`;
      }
      return '';
    });

    // 북마크 블록 변환
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.n2m.setCustomTransformer('bookmark', async (block: any) => {
      if ('bookmark' in block && block.bookmark) {
        const url = block.bookmark.url;
        return `[${url}](${url})`;
      }
      return '';
    });
  }

  // Property 헬퍼 함수들
  private getTitle(prop: unknown): string | null {
    if (prop && typeof prop === 'object' && 'title' in prop) {
      const titleProp = prop as { title: Array<{ plain_text: string }> };
      return titleProp.title?.[0]?.plain_text || null;
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

  private getSelect(prop: unknown): string | null {
    if (prop && typeof prop === 'object' && 'select' in prop) {
      const selectProp = prop as { select: { name: string } | null };
      return selectProp.select?.name || null;
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

  private getUrl(prop: unknown): string | null {
    if (prop && typeof prop === 'object' && 'url' in prop) {
      const urlProp = prop as { url: string | null };
      return urlProp.url || null;
    }
    return null;
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
