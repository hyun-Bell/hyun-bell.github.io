/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

// View Transitions API 타입 정의
interface Document {
  startViewTransition?: (callback: () => void | Promise<void>) => ViewTransition;
}

interface ViewTransition {
  finished: Promise<void>;
  ready: Promise<void>;
  updateCallbackDone: Promise<void>;
  skipTransition(): void;
}

// Window 타입 확장
declare global {
  interface Window {
    __theme: {
      getTheme: () => 'light' | 'dark';
      toggle: () => void;
      init: () => void;
      reinit: () => void;
      cleanup: () => void;
    };
  }
}

// 환경 변수 타입
interface ImportMetaEnv {
  readonly NOTION_TOKEN: string;
  readonly NOTION_DATABASE_ID: string;
  readonly NOTION_PAGES_DATABASE_ID?: string;
  readonly NOTION_PROJECTS_DATABASE_ID?: string;
  readonly NOTION_SNIPPETS_DATABASE_ID?: string;
  readonly PUBLIC_SITE_URL: string;
  readonly PUBLIC_SITE_TITLE: string;
  readonly PUBLIC_SITE_DESCRIPTION: string;
  readonly PUBLIC_AUTHOR_NAME: string;
  readonly PUBLIC_AUTHOR_EMAIL: string;
  readonly PUBLIC_GITHUB_URL?: string;
  readonly PUBLIC_TWITTER_URL?: string;
  readonly PUBLIC_LINKEDIN_URL?: string;
  readonly PUBLIC_GA_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {};
