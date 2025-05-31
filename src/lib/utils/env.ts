/**
 * 환경 변수 유틸리티
 */

export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvError';
  }
}

/**
 * 필수 환경 변수를 가져옵니다
 */
export function getRequiredEnv(key: string): string {
  const value = import.meta.env[key];

  if (!value) {
    throw new EnvError(`Missing required environment variable: ${key}`);
  }

  return value;
}

/**
 * 선택적 환경 변수를 가져옵니다
 */
export function getOptionalEnv(key: string, defaultValue?: string): string | undefined {
  return import.meta.env[key] || defaultValue;
}

/**
 * 환경 변수 설정 객체
 */
export const env = {
  // Notion
  NOTION_TOKEN: () => getRequiredEnv('NOTION_TOKEN'),
  NOTION_DATABASE_ID: () => getRequiredEnv('NOTION_DATABASE_ID'),

  // Site
  PUBLIC_SITE_URL: () => getRequiredEnv('PUBLIC_SITE_URL'),
  PUBLIC_SITE_TITLE: () => getRequiredEnv('PUBLIC_SITE_TITLE'),
  PUBLIC_SITE_DESCRIPTION: () => getRequiredEnv('PUBLIC_SITE_DESCRIPTION'),
  PUBLIC_AUTHOR_NAME: () => getOptionalEnv('PUBLIC_AUTHOR_NAME', 'Anonymous'),
  PUBLIC_AUTHOR_EMAIL: () => getRequiredEnv('PUBLIC_AUTHOR_EMAIL'),

  // Social (Optional)
  PUBLIC_GITHUB_URL: () => getOptionalEnv('PUBLIC_GITHUB_URL'),

  // Analytics (Optional)
  PUBLIC_GA_ID: () => getOptionalEnv('PUBLIC_GA_ID'),

  // Build
  NODE_ENV: import.meta.env.MODE,
  isProd: import.meta.env.PROD,
  isDev: import.meta.env.DEV,
} as const;

/**
 * 환경 변수 검증
 */
export function validateEnv(): void {
  const requiredVars = [
    'NOTION_TOKEN',
    'NOTION_DATABASE_ID',
    'PUBLIC_SITE_URL',
    'PUBLIC_SITE_TITLE',
    'PUBLIC_SITE_DESCRIPTION',
    'PUBLIC_AUTHOR_EMAIL',
  ];

  const missingVars = requiredVars.filter((key) => !import.meta.env[key]);

  if (missingVars.length > 0) {
    throw new EnvError(`Missing required environment variables:\n${missingVars.join('\n')}`);
  }
}
