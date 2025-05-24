/**
 * 사이트 전역 상수
 */

export const SITE_CONSTANTS = {
  // 네비게이션
  NAV_ITEMS: [
    { label: '홈', href: '/', order: 0 },
    { label: '블로그', href: '/blog', order: 1 },
    { label: '프로젝트', href: '/projects', order: 2 },
    { label: '소개', href: '/about', order: 3 },
  ],

  // 페이지네이션
  POSTS_PER_PAGE: 10,
  PROJECTS_PER_PAGE: 9,

  // 기본값
  DEFAULT_OG_IMAGE: '/og-default.png',
} as const;

export type NavItem = (typeof SITE_CONSTANTS.NAV_ITEMS)[number];
