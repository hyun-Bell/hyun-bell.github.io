# 테마 시스템 설계 문서

## 개요

블로그의 다크/라이트 테마 시스템은 FOUC(Flash of Unstyled Content) 방지와 사용자 경험 최적화를 중심으로 설계되었습니다.

## 핵심 설계 원칙

### 1. FOUC 방지 우선

- 페이지 로드 시 테마가 즉시 적용되어 깜빡임 현상 방지
- `is:inline` 스크립트로 HTML 파싱과 동시에 테마 적용

### 2. 선언적 함수 설계

- 각 함수가 단일 책임을 가지며 이름만으로 기능 파악 가능
- 주석 대신 명확한 함수명과 상수로 자기 문서화

### 3. 견고한 상태 관리

- localStorage 접근 실패에 대한 안전한 fallback
- 시스템 테마 변경과 크로스 탭 동기화 지원

## 아키텍처 구성

### ThemeScript 컴포넌트 (`src/components/common/ThemeScript.astro`)

테마 시스템의 핵심으로, 즉시 실행 함수(IIFE) 패턴으로 구현:

```typescript
(() => {
  // 상수 정의
  const STORAGE_KEY = 'theme';
  const DARK_CLASS = 'dark';
  const THEMES = { LIGHT: 'light', DARK: 'dark' };
  const THEME_COLORS = { LIGHT: '#ffffff', DARK: '#0f172a' };

  // 핵심 함수들
  const getStoredTheme = () => {
    /* 저장된 테마 조회 */
  };
  const getSystemTheme = () => {
    /* 시스템 테마 감지 */
  };
  const getPreferredTheme = () => {
    /* 우선순위 테마 결정 */
  };
  const updateDocumentTheme = (theme) => {
    /* DOM 테마 적용 */
  };
  const persistTheme = (theme) => {
    /* 테마 저장 */
  };

  // 초기화 및 이벤트 바인딩
  updateDocumentTheme(getPreferredTheme());
  window.toggleTheme = toggleTheme;
  // ... 이벤트 리스너 등록
})();
```

### 함수별 책임

#### `getStoredTheme()`

- localStorage에서 테마 조회
- 유효하지 않은 값에 대한 안전한 처리
- try-catch로 접근 실패 처리

#### `getSystemTheme()`

- `prefers-color-scheme` 미디어 쿼리로 시스템 테마 감지
- 간결한 삼항 연산자로 구현

#### `getPreferredTheme()`

- 저장된 테마가 우선, 없으면 시스템 테마 사용
- 테마 우선순위 로직의 단일 진입점

#### `updateDocumentTheme(theme)`

- 실제 DOM에 테마 적용
- `html` 클래스, `colorScheme`, `theme-color` 메타태그 동시 업데이트
- 모든 테마 관련 DOM 조작의 중앙화

#### `persistTheme(theme)`

- localStorage에 테마 저장
- 저장 실패에 대한 안전한 처리

### 이벤트 처리

#### `toggleTheme()`

- 현재 테마 토글 및 저장
- 커스텀 이벤트 발생으로 다른 컴포넌트와 통신

#### `handleSystemThemeChange(e)`

- 시스템 테마 변경 감지
- 사용자가 명시적으로 설정한 테마가 없을 때만 반응

#### `handleCrossTabSync(e)`

- 다른 탭에서의 테마 변경 동기화
- storage 이벤트를 통한 실시간 동기화

## 코드 하이라이팅 통합

### Astro v5 Shiki 듀얼 테마 설정

`astro.config.mjs`에서 듀얼 테마 설정:

```javascript
shikiConfig: {
  themes: {
    light: 'github-light',
    dark: 'github-dark',
  },
  defaultColor: false,
  wrap: true,
  langs: ['javascript', 'typescript', 'json', 'html', 'css', 'bash', 'python', 'astro'],
}
```

### CSS 변수 기반 테마 전환

`src/styles/code-theme.css`에서 CSS 변수 활용:

```css
.astro-code,
.astro-code span {
  color: var(--shiki-light) !important;
  background-color: var(--shiki-light-bg) !important;
}

html.dark .astro-code,
html.dark .astro-code span {
  color: var(--shiki-dark) !important;
  background-color: var(--shiki-dark-bg) !important;
}
```

### 중요한 CSS 선택자 이슈

Astro v5에서는 `.shiki` 클래스가 아닌 `.astro-code` 클래스를 사용합니다.
이는 v4와의 주요 차이점으로, CSS 선택자를 올바르게 설정해야 테마 전환이 작동합니다.

## 레이아웃 통합

### BaseLayout.astro

- `ThemeScript` 컴포넌트 포함
- `theme-color` 메타태그 초기값 설정
- 기존 theme.ts 의존성 제거

### Header.astro

- 테마 토글 버튼에 `onclick="window.toggleTheme && window.toggleTheme()"` 추가
- 전역 함수를 통한 간단한 테마 전환

## 성능 최적화

### 즉시 실행

- `is:inline` 속성으로 HTML 파싱과 동시에 실행
- 별도 JavaScript 번들링 없이 인라인으로 처리

### 최소한의 코드

- 필수 기능만 포함하여 초기 로드 시간 최소화
- 복잡한 라이브러리나 의존성 없음

### 안전한 오류 처리

- localStorage 접근 실패 시 기본값 사용
- 모든 외부 API 호출에 try-catch 적용

## 브라우저 호환성

### 지원 기능

- `localStorage` (fallback 포함)
- `matchMedia` for 시스템 테마 감지
- `CustomEvent` for 컴포넌트 간 통신
- CSS 변수와 `prefers-color-scheme`

### Fallback 전략

- localStorage 실패 시 시스템 테마 사용
- 시스템 테마 미지원 시 라이트 모드 기본값

## 향후 확장 가능성

### 추가 테마 지원

- `THEMES` 객체 확장으로 새 테마 추가 가능
- CSS 변수 패턴으로 쉬운 색상 커스터마이징

### 애니메이션 효과

- `theme-changed` 커스텀 이벤트를 활용한 전환 애니메이션
- CSS transition과 조합 가능

### 컴포넌트별 테마 적용

- 커스텀 이벤트 시스템을 통한 개별 컴포넌트 반응
- 세밀한 테마 제어 가능

## 디버깅 가이드

### 테마가 적용되지 않는 경우

1. 브라우저 개발자 도구에서 `html` 클래스 확인
2. CSS 선택자가 `.astro-code`인지 확인 (`.shiki` 아님)
3. localStorage에 올바른 값이 저장되었는지 확인

### FOUC가 발생하는 경우

1. `ThemeScript`가 `<head>` 섹션에 포함되었는지 확인
2. `is:inline` 속성이 올바르게 설정되었는지 확인
3. 스크립트 로드 순서 검토

이 시스템은 성능, 사용자 경험, 유지보수성을 모두 고려한 견고한 테마 솔루션입니다.
