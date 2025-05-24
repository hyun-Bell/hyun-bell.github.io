# Components Structure

## 📁 폴더 구조

- **ui/**: 재사용 가능한 기본 UI 컴포넌트 (Button, Card, Input 등)
- **layout/**: 레이아웃 관련 컴포넌트 (Header, Footer, Sidebar 등)
- **blog/**: 블로그 전용 컴포넌트 (BlogCard, TagCloud, TOC 등)
- **islands/**: Interactive React 컴포넌트 (Client-side hydration)

## 🏝️ Islands Architecture

Astro의 Islands Architecture를 활용하여 필요한 컴포넌트만 선택적으로 hydrate합니다:

- `client:load`: 페이지 로드 시 즉시 hydrate
- `client:idle`: 메인 스레드가 idle 상태일 때 hydrate
- `client:visible`: 컴포넌트가 뷰포트에 보일 때 hydrate
- `client:media`: 특정 미디어 쿼리가 매칭될 때 hydrate
