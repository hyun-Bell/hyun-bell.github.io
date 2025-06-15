/**
 * 사이트 전역 상수
 */

export const SITE_CONFIG = {
  url: import.meta.env.PUBLIC_SITE_URL || 'https://hyunBell.github.io',
  title: import.meta.env.PUBLIC_SITE_TITLE || 'hyunBell.dev',
  description: import.meta.env.PUBLIC_SITE_DESCRIPTION || '개발자의 성장 기록',
  author: {
    name: import.meta.env.PUBLIC_AUTHOR_NAME || 'hyunBell',
    email: import.meta.env.PUBLIC_AUTHOR_EMAIL || '',
    github: import.meta.env.PUBLIC_GITHUB_URL || 'https://github.com/hyunBell',
  },
  defaultImage: '/og-default.png',
  postsPerPage: 10,
} as const;

// 네비게이션 설정
export const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/posts', label: 'Posts' },
  { href: '/about', label: 'About' },
] as const;

// 경로 설정
export const ROUTES = {
  home: '/',
  posts: '/posts',
  about: '/about',
} as const;

export const SITE_CONSTANTS = {
  NAV_ITEMS,
  POSTS_PER_PAGE: SITE_CONFIG.postsPerPage,
  PROJECTS_PER_PAGE: 9,
  DEFAULT_OG_IMAGE: SITE_CONFIG.defaultImage,
} as const;

export type NavItem = (typeof NAV_ITEMS)[number];
