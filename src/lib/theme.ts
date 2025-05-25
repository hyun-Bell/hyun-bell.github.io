/**
 * 테마 관리 모듈
 * View Transitions와 완벽하게 호환되는 다크모드 시스템
 */

export type Theme = 'light' | 'dark';

export class ThemeManager {
  private static instance: ThemeManager;
  private theme: Theme;

  private constructor() {
    this.theme = this.getInitialTheme();
  }

  static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  private getInitialTheme(): Theme {
    // 브라우저 환경 체크
    if (typeof window === 'undefined') {
      return 'light';
    }

    // 1. localStorage 확인
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }

    // 2. 시스템 설정 확인
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    return 'light';
  }

  getTheme(): Theme {
    return this.theme;
  }

  setTheme(theme: Theme): void {
    this.theme = theme;

    // 브라우저 환경에서만 실행
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', theme);
      this.applyTheme();
    }
  }

  toggleTheme(): void {
    this.setTheme(this.theme === 'light' ? 'dark' : 'light');
  }

  applyTheme(): void {
    // 브라우저 환경 체크
    if (typeof document === 'undefined') return;

    const root = document.documentElement;

    if (this.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // 메타 테마 색상도 업데이트
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', this.theme === 'dark' ? '#030712' : '#ffffff');
    }
  }

  // 초기화 (페이지 로드 시 실행)
  init(): void {
    // 브라우저 환경 체크
    if (typeof window === 'undefined') return;

    this.applyTheme();

    // 시스템 테마 변경 감지
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      // localStorage에 저장된 값이 없을 때만 시스템 설정 따르기
      if (!localStorage.getItem('theme')) {
        this.theme = e.matches ? 'dark' : 'light';
        this.applyTheme();
      }
    });
  }
}

// 전역 인스턴스 export
export const themeManager = ThemeManager.getInstance();
