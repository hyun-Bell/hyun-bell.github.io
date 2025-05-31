/**
 * Notion 블록 타입 정의
 */

export interface NotionRichText {
  plain_text: string;
  href?: string | null;
  annotations?: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
    color: string;
  };
}

export interface NotionImageBlock {
  id: string;
  type: 'image';
  image: {
    type: 'external' | 'file';
    external?: { url: string };
    file?: { url: string; expiry_time?: string };
    caption: NotionRichText[];
  };
}

export interface NotionCodeBlock {
  id: string;
  type: 'code';
  code: {
    rich_text: NotionRichText[];
    language: string;
  };
}

export interface NotionBookmarkBlock {
  id: string;
  type: 'bookmark';
  bookmark: {
    url: string;
    caption?: NotionRichText[];
  };
}

export type NotionBlock = NotionImageBlock | NotionCodeBlock | NotionBookmarkBlock;
