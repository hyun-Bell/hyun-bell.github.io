/**
 * 최적화된 테마 시스템
 */

export type Theme = 'light' | 'dark';

class ThemeManager {
  private static instance: ThemeManager;
  private theme: Theme;

  private constructor() {
    this.theme = this.getStoredTheme();
  }

  static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  private getStoredTheme(): Theme {
    if (typeof window === 'undefined') return 'light';

    const stored = localStorage.getItem('theme') as Theme;
    if (stored === 'light' || stored === 'dark') return stored;

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  init(): void {
    // 즉시 테마 적용
    this.applyCurrentTheme();
    this.attachToggleButton();
  }

  reinit(): void {
    // 버튼만 재연결
    this.attachToggleButton();
  }

  // public 메서드로 변경
  applyCurrentTheme(): void {
    document.documentElement.classList.toggle('dark', this.theme === 'dark');
  }

  private attachToggleButton(): void {
    const button = document.getElementById('theme-toggle');
    if (!button) return;

    // 기존 리스너 제거 후 재연결
    const newButton = button.cloneNode(true) as HTMLElement;
    button.parentNode?.replaceChild(newButton, button);

    newButton.addEventListener('click', () => this.toggle());
  }

  toggle(): void {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', this.theme);
    this.applyCurrentTheme();
  }

  getTheme(): Theme {
    return this.theme;
  }

  // cleanup 메서드 추가
  cleanup(): void {
    // 필요시 정리 작업
  }
}

export const theme = ThemeManager.getInstance();

// 전역 노출
if (typeof window !== 'undefined') {
  window.__theme = {
    getTheme: () => theme.getTheme(),
    toggle: () => theme.toggle(),
    init: () => theme.init(),
    reinit: () => theme.reinit(),
    cleanup: () => theme.cleanup(),
  };
}
