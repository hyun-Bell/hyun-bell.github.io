/**
 * 테마 관리 모듈
 * View Transitions와 완벽하게 호환되는 다크모드 시스템
 */

// Window 타입 확장
declare global {
  interface Window {
    __theme: {
      current: 'light' | 'dark';
      apply: (theme: 'light' | 'dark') => void;
      get: () => 'light' | 'dark';
    };
  }
}

export type Theme = 'light' | 'dark';

export class ThemeManager {
  private static instance: ThemeManager;

  private constructor() {}

  static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  getTheme(): Theme {
    if (typeof window === 'undefined') return 'light';

    // window.__theme가 있으면 사용, 없으면 localStorage 확인
    if (window.__theme) {
      return window.__theme.current;
    }

    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  setTheme(theme: Theme): void {
    if (typeof window === 'undefined') return;

    // localStorage에 저장
    localStorage.setItem('theme', theme);

    // window.__theme 업데이트
    if (window.__theme) {
      window.__theme.current = theme;
      window.__theme.apply(theme);
    } else {
      // fallback
      this.applyTheme(theme);
    }
  }

  toggleTheme(): void {
    const currentTheme = this.getTheme();
    this.setTheme(currentTheme === 'light' ? 'dark' : 'light');
  }

  applyTheme(theme?: Theme): void {
    if (typeof window === 'undefined') return;

    const themeToApply = theme || this.getTheme();

    if (window.__theme) {
      window.__theme.apply(themeToApply);
    } else {
      // fallback
      const root = document.documentElement;
      if (themeToApply === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }

  init(): void {
    if (typeof window === 'undefined') return;

    // 초기 테마 적용
    this.applyTheme();

    // 시스템 테마 변경 감지
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      // localStorage에 저장된 값이 없을 때만 시스템 설정 따르기
      if (!localStorage.getItem('theme')) {
        const newTheme = e.matches ? 'dark' : 'light';
        this.setTheme(newTheme);
      }
    });
  }
}

// 전역 인스턴스 export
export const themeManager = ThemeManager.getInstance();
