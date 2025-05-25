# hyunBell.dev

개인 기술 블로그

## Skills

- **Framework**: Astro 5.8
- **Language**: TypeScript 5.8 (strict mode)
- **Styling**: Tailwind CSS 3.4
- **CMS**: Notion API
- **Deployment**: GitHub Pages

## Astro 선택 이유

### 1. 빌드 타임 렌더링

Astro는 빌드 시점에 모든 페이지를 정적으로 생성합니다. 블로그처럼 콘텐츠가 자주 바뀌지 않는 사이트에 최적입니다.

### 2. Zero JavaScript by Default

필요한 곳에만 JavaScript를 선택적으로 추가할 수 있습니다. 불필요한 번들 사이즈를 줄여 로딩 속도가 빠릅니다.

### 3. Content Collections

Astro의 Content Collections API로 타입 안전한 콘텐츠 관리가 가능합니다. Notion API와 연동하여 빌드 타임에 데이터를 가져와 정적 페이지로 만듭니다.

```typescript
// 타입 안전한 콘텐츠 관리
const posts = await getCollection('blog');
```

### 4. Island Architecture

페이지의 대부분은 정적 HTML이고, 필요한 부분만 인터랙티브하게 만들 수 있습니다.

### 5. View Transitions

SPA처럼 부드러운 페이지 전환을 제공하면서도 정적 사이트의 장점을 유지합니다.

## 프로젝트 구조

```
src/
├── content/        # Content Collections
├── lib/
│   ├── notion/     # Notion API 클라이언트
│   └── utils/      # 유틸리티 함수
├── pages/          # File-based routing
└── components/     # Astro 컴포넌트
```

## 주요 기능

- Notion 데이터베이스와 연동된 자동 포스트 생성
- 다크모드 지원 (View Transitions 유지)
- 읽기 시간 자동 계산
- 태그 기반 분류
- 페이지네이션

## 실행 방법

```bash
pnpm install
pnpm dev
```

## 배포

main 브랜치에 푸시하면 GitHub Actions가 자동으로 빌드하고 배포합니다.

---
