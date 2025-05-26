/**
 * 통합 테마 매니저
 * 플리커링 방지를 위한 최적화 버전
 */

export type Theme = 'light' | 'dark';

interface ThemeManager {
  init: () => void;
  reinit: () => void;
  persist: () => void;
  toggle: () => void;
  get: () => Theme;
  set: (theme: Theme) => void;
}

class ThemeManagerImpl implements ThemeManager {
  private currentTheme: Theme;
  private listeners: Set<() => void> = new Set();
  private rafId: number | null = null;

  constructor() {
    this.currentTheme = this.detectTheme();
  }

  private detectTheme(): Theme {
    if (typeof window === 'undefined') return 'light';

    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') return stored;

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private applyTheme(theme: Theme, animate = false): void {
    // 이전 RAF 취소
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }

    const applyChanges = () => {
      const root = document.documentElement;

      // 애니메이션이 필요한 경우만 클래스 추가
      if (animate) {
        root.classList.add('theme-transition');
      }

      // 동기적으로 테마 적용
      if (theme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }

      // 메타 태그 업데이트
      document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
        const isDarkMedia = meta.getAttribute('media')?.includes('dark');
        if ((isDarkMedia && theme === 'dark') || (!isDarkMedia && theme === 'light')) {
          meta.setAttribute('content', theme === 'dark' ? '#0f172a' : '#ffffff');
        }
      });

      // 애니메이션 클래스 제거
      if (animate) {
        setTimeout(() => {
          root.classList.remove('theme-transition');
        }, 300);
      }
    };

    // 애니메이션이 없는 경우 즉시 적용
    if (!animate) {
      applyChanges();
    } else {
      // 애니메이션이 있는 경우 RAF 사용
      this.rafId = requestAnimationFrame(applyChanges);
    }
  }

  private attachListeners(): void {
    const button = document.getElementById('theme-toggle');
    if (!button) return;

    // 중복 방지
    if (button.dataset.listenerAttached === 'true') return;

    const handleClick = (e: Event) => {
      e.stopPropagation();
      this.toggle();
    };

    button.addEventListener('click', handleClick);
    button.dataset.listenerAttached = 'true';

    // 클린업 등록
    this.listeners.add(() => {
      button.removeEventListener('click', handleClick);
      button.dataset.listenerAttached = 'false';
    });

    // 시스템 테마 변경 감지
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) {
        this.currentTheme = e.matches ? 'dark' : 'light';
        this.applyTheme(this.currentTheme, true);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    this.listeners.add(() => mediaQuery.removeEventListener('change', handleChange));
  }

  init(): void {
    // 초기화는 애니메이션 없이
    this.applyTheme(this.currentTheme, false);
    this.attachListeners();
  }

  reinit(): void {
    this.cleanup();
    this.attachListeners();
  }

  persist(): void {
    // View Transitions 중 테마 유지 (애니메이션 없이)
    this.currentTheme = this.detectTheme();
    this.applyTheme(this.currentTheme, false);
  }

  toggle(): void {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', this.currentTheme);
    this.applyTheme(this.currentTheme, true);

    // 커스텀 이벤트
    window.dispatchEvent(
      new CustomEvent('theme-changed', {
        detail: { theme: this.currentTheme },
      }),
    );
  }

  get(): Theme {
    return this.currentTheme;
  }

  set(theme: Theme): void {
    this.currentTheme = theme;
    localStorage.setItem('theme', theme);
    this.applyTheme(theme, true);
  }

  private cleanup(): void {
    this.listeners.forEach((cleanup) => cleanup());
    this.listeners.clear();

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}

export const themeManager: ThemeManager = new ThemeManagerImpl();

if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__themeManager = themeManager;
}
