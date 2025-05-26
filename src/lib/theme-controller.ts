/**
 * 통합 테마 컨트롤러
 * View Transitions ClientRouter와 완벽하게 호환되는 테마 시스템
 */

export type Theme = 'light' | 'dark';

class ThemeController {
  private static instance: ThemeController;
  private currentTheme: Theme;

  private constructor() {
    this.currentTheme = this.getStoredTheme() || this.getSystemTheme();
  }

  static getInstance(): ThemeController {
    if (!ThemeController.instance) {
      ThemeController.instance = new ThemeController();
    }
    return ThemeController.instance;
  }

  /**
   * 저장된 테마 가져오기
   */
  private getStoredTheme(): Theme | null {
    if (typeof window === 'undefined') return null;

    const stored = localStorage.getItem('theme');
    return stored === 'light' || stored === 'dark' ? stored : null;
  }

  /**
   * 시스템 테마 가져오기
   */
  private getSystemTheme(): Theme {
    if (typeof window === 'undefined') return 'light';

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  /**
   * 현재 테마 가져오기
   */
  getTheme(): Theme {
    return this.currentTheme;
  }

  /**
   * 테마 설정
   */
  setTheme(theme: Theme): void {
    if (typeof window === 'undefined') return;

    this.currentTheme = theme;
    localStorage.setItem('theme', theme);
    this.applyTheme();
  }

  /**
   * 테마 토글
   */
  toggleTheme(): void {
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  /**
   * DOM에 테마 적용
   */
  applyTheme(): void {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;

    if (this.currentTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // 메타 테마 컬러 업데이트
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', this.currentTheme === 'dark' ? '#0f172a' : '#ffffff');
    }
  }

  /**
   * 테마 초기화 및 이벤트 리스너 설정
   */
  init(): void {
    if (typeof window === 'undefined') return;

    // 초기 테마 적용
    this.applyTheme();

    // 테마 토글 버튼 이벤트 설정
    this.setupThemeToggle();

    // 시스템 테마 변경 감지
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      if (!this.getStoredTheme()) {
        this.currentTheme = e.matches ? 'dark' : 'light';
        this.applyTheme();
      }
    });
  }

  /**
   * 테마 토글 버튼 이벤트 설정
   */
  setupThemeToggle(): void {
    const button = document.getElementById('theme-toggle');
    if (!button) return;

    // 클릭 이벤트 추가
    button.addEventListener('click', () => {
      this.toggleTheme();
    });
  }

  /**
   * View Transitions 후 재초기화
   */
  reinitialize(): void {
    this.setupThemeToggle();
  }
}

// 전역 인스턴스
export const themeController = ThemeController.getInstance();

// 전역 노출
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__themeController = themeController;
}
