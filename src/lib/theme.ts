/**
 * 통합 테마 시스템
 */

export type Theme = 'light' | 'dark';

interface ThemeState {
  current: Theme;
  // eslint-disable-next-line no-undef
  listeners: WeakMap<HTMLElement, EventListener>;
}

class ThemeSystem {
  private static instance: ThemeSystem;
  private state: ThemeState;
  private mediaQuery: MediaQueryList;

  private constructor() {
    this.state = {
      current: this.detectInitialTheme(),
      listeners: new WeakMap(),
    };
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  }

  static getInstance(): ThemeSystem {
    if (!ThemeSystem.instance && typeof window !== 'undefined') {
      ThemeSystem.instance = new ThemeSystem();
    }
    return ThemeSystem.instance;
  }

  /**
   * 초기 테마 감지
   */
  private detectInitialTheme(): Theme {
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored === 'light' || stored === 'dark') return stored;

    return this.mediaQuery.matches ? 'dark' : 'light';
  }

  /**
   * 테마 적용 (FOUC 방지를 위해 동기적 실행)
   */
  private applyTheme(theme: Theme, animate = false): void {
    const root = document.documentElement;

    // 애니메이션 클래스 관리
    if (animate) {
      root.style.setProperty('--theme-transition-duration', '0.3s');
    } else {
      root.style.setProperty('--theme-transition-duration', '0s');
    }

    // 테마 적용
    root.classList.toggle('dark', theme === 'dark');

    // 메타 테마 색상 업데이트
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'dark' ? '#0f172a' : '#ffffff');
    }

    // 애니메이션 후 정리
    if (animate) {
      setTimeout(() => {
        root.style.removeProperty('--theme-transition-duration');
      }, 300);
    }
  }

  /**
   * 초기화 (페이지 로드 시)
   */
  init(): void {
    // 1. 테마 즉시 적용 (FOUC 방지)
    this.applyTheme(this.state.current, false);

    // 2. 버튼 이벤트 설정
    this.attachToggleButton();

    // 3. 시스템 테마 변경 감지
    this.mediaQuery.addEventListener('change', this.handleSystemThemeChange);
  }

  /**
   * View Transitions 후 재초기화
   */
  reinit(): void {
    // 버튼만 다시 연결 (테마는 이미 유지됨)
    this.attachToggleButton();
  }

  /**
   * 토글 버튼 연결
   */
  private attachToggleButton(): void {
    const button = document.getElementById('theme-toggle');
    if (!button) return;

    // 이미 연결된 리스너가 있는지 확인
    if (this.state.listeners.has(button)) return;

    const handler = () => this.toggle();
    button.addEventListener('click', handler);
    this.state.listeners.set(button, handler);
  }

  /**
   * 시스템 테마 변경 핸들러
   */
  private handleSystemThemeChange = (e: MediaQueryListEvent): void => {
    // 사용자가 수동으로 설정하지 않은 경우만 자동 변경
    if (!localStorage.getItem('theme')) {
      this.state.current = e.matches ? 'dark' : 'light';
      this.applyTheme(this.state.current, true);
    }
  };

  /**
   * 테마 토글
   */
  toggle(): void {
    this.state.current = this.state.current === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', this.state.current);
    this.applyTheme(this.state.current, true);

    // 커스텀 이벤트 발생
    window.dispatchEvent(
      new CustomEvent('theme-changed', {
        detail: { theme: this.state.current },
      }),
    );
  }

  /**
   * 현재 테마 가져오기
   */
  getTheme(): Theme {
    return this.state.current;
  }

  /**
   * 정리 (필요시)
   */
  cleanup(): void {
    this.mediaQuery.removeEventListener('change', this.handleSystemThemeChange);
    this.state.listeners = new WeakMap();
  }
}

// 전역 인스턴스
export const theme = ThemeSystem.getInstance();

// 전역 노출 (디버깅용)
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__theme = theme;
}
