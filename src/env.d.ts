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
    __currentTheme: 'light' | 'dark';
    __themeController: {
      getTheme: () => 'light' | 'dark';
      setTheme: (theme: 'light' | 'dark') => void;
      toggleTheme: () => void;
      applyTheme: () => void;
      init: () => void;
      cleanup: () => void;
    };
  }
}

interface ImportMetaEnv {
  // Notion API Configuration
  readonly NOTION_TOKEN: string;
  readonly NOTION_DATABASE_ID: string;
  readonly NOTION_PAGES_DATABASE_ID: string;
  readonly NOTION_PROJECTS_DATABASE_ID?: string;
  readonly NOTION_SNIPPETS_DATABASE_ID?: string;

  // Public Environment Variables
  readonly PUBLIC_SITE_URL: string;
  readonly PUBLIC_GA_ID?: string;
  readonly PUBLIC_SITE_TITLE: string;
  readonly PUBLIC_SITE_DESCRIPTION: string;
  readonly PUBLIC_AUTHOR_NAME: string;
  readonly PUBLIC_AUTHOR_EMAIL: string;
  readonly PUBLIC_GITHUB_URL?: string;
  readonly PUBLIC_TWITTER_URL?: string;
  readonly PUBLIC_LINKEDIN_URL?: string;

  // Build Configuration
  readonly NODE_ENV: 'development' | 'production' | 'test';
  readonly PROD: boolean;
  readonly DEV: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {};
