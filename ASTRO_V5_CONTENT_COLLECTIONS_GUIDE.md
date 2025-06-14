# Astro v5 Content Collections API 가이드

## 개요

Astro v5에서는 Content Collections API가 대대적으로 개편되었습니다. 가장 중요한 변화는 **Content Layer API**의 도입으로, 더 유연하고 강력한 콘텐츠 관리가 가능해졌습니다.

## Content Layer API란?

Content Layer API는 Astro v5의 핵심 기능으로, 다양한 소스의 콘텐츠를 통합 관리할 수 있는 새로운 아키텍처입니다.

### 주요 특징

1. **커스텀 로더(Loader) 시스템**

   - 파일 시스템 외부의 콘텐츠 소스 지원 (API, 데이터베이스 등)
   - 증분 빌드를 위한 digest 기반 변경 감지
   - 비동기 데이터 로딩 최적화

2. **향상된 타입 안정성**

   - 스키마 기반 자동 타입 생성
   - 런타임 검증과 컴파일 타임 타입 체크

3. **성능 최적화**
   - 빌드 시간 캐싱
   - 병렬 처리
   - 필요한 데이터만 선택적 로딩

## v4에서 v5로 마이그레이션

### 1. 기본 구조 변경

**v4 (기존 방식)**

```typescript
// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  schema: z.object({
    title: z.string(),
    pubDate: z.date(),
    description: z.string(),
  }),
});

export const collections = { blog };
```

**v5 (새로운 방식)**

```typescript
// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  // 로더를 통한 데이터 소스 정의
  loader: async () => {
    // 파일 시스템, API, 데이터베이스 등 어떤 소스든 가능
    return [
      {
        id: 'post-1', // slug → id로 변경
        data: {
          title: 'First Post',
          pubDate: new Date('2024-01-01'),
          description: 'My first post',
        },
      },
    ];
  },
  schema: z.object({
    title: z.string(),
    pubDate: z.date(),
    description: z.string(),
  }),
});

export const collections = { blog };
```

### 2. 주요 API 변경사항

#### ID 시스템

- `slug` → `id`로 변경
- ID는 컬렉션 내에서 고유해야 함
- 파일 기반이 아니므로 자유로운 ID 지정 가능

#### render() 함수

```typescript
// v4
const { Content } = await post.render();

// v5
const { Content } = await render(post);
```

#### 데이터 접근

```typescript
// v4
const posts = await getCollection('blog');
const post = posts.find((p) => p.slug === 'my-post');

// v5
const posts = await getCollection('blog');
const post = posts.find((p) => p.id === 'my-post');
```

## 커스텀 로더 구현

### 기본 로더 구조

```typescript
import type { Loader } from 'astro:content';

export const blogLoader: Loader = {
  name: 'blog-loader',
  load: async ({ store, logger, config }) => {
    // 데이터 가져오기
    const posts = await fetchPostsFromAPI();

    // 각 포스트 처리
    for (const post of posts) {
      // digest를 통한 변경 감지
      const digest = generateDigest(post);

      // 스토어에 저장
      store.set({
        id: post.id,
        data: post,
        digest, // 변경 감지용
      });
    }
  },
};
```

### 증분 빌드 최적화

```typescript
export const optimizedLoader: Loader = {
  name: 'optimized-loader',
  load: async ({ store, logger }) => {
    // 1. 메타데이터만 먼저 가져오기
    const summaries = await fetchPostSummaries();

    // 2. 변경된 항목만 필터링
    const toUpdate = summaries.filter((summary) => {
      const existing = store.get(summary.id);
      const newDigest = generateDigest(summary);
      return !existing || existing.digest !== newDigest;
    });

    // 3. 변경된 항목만 전체 콘텐츠 가져오기
    const updated = await Promise.all(
      toUpdate.map(async (summary) => {
        const fullContent = await fetchFullPost(summary.id);
        return {
          id: summary.id,
          data: fullContent,
          digest: generateDigest(summary),
        };
      }),
    );

    // 4. 스토어 업데이트
    updated.forEach((post) => store.set(post));

    logger.info(`Updated ${updated.length} posts`);
  },
};
```

## 실제 프로젝트 예제: Notion 통합

이 프로젝트에서 실제로 사용 중인 Notion 통합 로더 예제입니다:

```typescript
// src/lib/content/loader.ts
import type { Loader } from 'astro:content';
import { notionClient } from '@lib/notion/client';

export const blogLoader: Loader = {
  name: 'notion-blog-loader',
  load: async ({ store, logger, config, parseData }) => {
    logger.info('Starting Notion sync...');

    // 1. Notion에서 포스트 요약 정보 가져오기
    const summaries = await notionClient.getPostSummaries();

    // 2. 배치 처리로 성능 최적화
    const BATCH_SIZE = 5;
    for (let i = 0; i < summaries.length; i += BATCH_SIZE) {
      const batch = summaries.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (summary) => {
          // digest로 변경 확인
          const digest = generateDigest({
            lastModified: summary.lastEditedTime,
            title: summary.title,
          });

          const existing = store.get(summary.slug);
          if (existing?.digest === digest) {
            return; // 변경 없음
          }

          // 전체 콘텐츠 가져오기
          const fullPost = await notionClient.getFullPost(summary.id);

          // 스키마 검증 및 저장
          const parsed = await parseData({
            id: summary.slug,
            data: {
              title: fullPost.title,
              description: fullPost.description,
              pubDate: new Date(fullPost.publishedDate),
              tags: fullPost.tags,
              content: fullPost.content,
            },
          });

          store.set({
            ...parsed,
            digest,
          });
        }),
      );
    }

    logger.info(`Synced ${summaries.length} posts from Notion`);
  },
};
```

## 고급 패턴

### 1. 다중 소스 통합

```typescript
const blog = defineCollection({
  loader: async () => {
    // 여러 소스에서 데이터 수집
    const [notionPosts, markdownPosts, cmsPosts] = await Promise.all([
      fetchFromNotion(),
      fetchFromMarkdown(),
      fetchFromCMS(),
    ]);

    // 통합 및 정규화
    return [...notionPosts, ...markdownPosts, ...cmsPosts].map((post) => ({
      id: post.id,
      data: normalizePost(post),
    }));
  },
});
```

### 2. 조건부 로딩

```typescript
const blog = defineCollection({
  loader: async ({ config }) => {
    // 개발/프로덕션 환경에 따른 다른 소스
    if (config.mode === 'development') {
      return loadFromLocalFiles();
    } else {
      return loadFromAPI();
    }
  },
});
```

### 3. 캐싱 전략

```typescript
const blog = defineCollection({
  loader: {
    name: 'cached-loader',
    load: async ({ store, meta }) => {
      // 마지막 동기화 시간 확인
      const lastSync = meta.get('lastSync');
      const now = Date.now();

      // 1시간 이내면 스킵
      if (lastSync && now - lastSync < 3600000) {
        return;
      }

      // 새로운 데이터 로드
      const posts = await fetchPosts();
      posts.forEach((post) => store.set(post));

      // 동기화 시간 업데이트
      meta.set('lastSync', now);
    },
  },
});
```

## 성능 모니터링

```typescript
const blog = defineCollection({
  loader: {
    name: 'monitored-loader',
    load: async ({ store, logger }) => {
      const startTime = Date.now();
      let processedCount = 0;

      try {
        const posts = await fetchPosts();

        for (const post of posts) {
          const processStart = Date.now();

          // 처리 로직
          await processPost(post);
          store.set(post);

          processedCount++;
          logger.debug(`Processed ${post.id} in ${Date.now() - processStart}ms`);
        }

        const totalTime = Date.now() - startTime;
        logger.info(`✓ Processed ${processedCount} posts in ${totalTime}ms`);
        logger.info(`  Average: ${(totalTime / processedCount).toFixed(2)}ms per post`);
      } catch (error) {
        logger.error(`Failed after processing ${processedCount} posts`, error);
        throw error;
      }
    },
  },
});
```

## 마이그레이션 체크리스트

v4에서 v5로 마이그레이션할 때 확인해야 할 사항들:

- [ ] `slug` → `id`로 모든 참조 변경
- [ ] `getEntryBySlug()` → `getEntry()` 사용
- [ ] `entry.render()` → `render(entry)` 변경
- [ ] 파일 기반 컬렉션을 로더 기반으로 전환
- [ ] `compiledContent()` 비동기 호출로 변경
- [ ] `Astro.glob()` → `import.meta.glob()` 변경
- [ ] `<ViewTransitions />` → `<ClientRouter />` 변경

## 트러블슈팅

### 일반적인 문제들

1. **"Cannot find module 'astro:content'" 에러**

   - 클라이언트 사이드에서 `astro:content` import 시도
   - 해결: 서버 사이드에서만 사용

2. **digest 불일치로 인한 무한 빌드**

   - digest 생성 로직의 일관성 문제
   - 해결: 정렬된 키와 안정적인 해시 함수 사용

3. **메모리 초과**
   - 대량 데이터 한번에 로딩
   - 해결: 배치 처리 및 스트리밍 사용

## 참고 자료

- [Astro v5 Content Layer RFC](https://github.com/withastro/roadmap/blob/content-layer/proposals/0047-content-layer.md)
- [Astro v5 마이그레이션 가이드](https://docs.astro.build/en/guides/upgrade-to/v5/)
- [Content Collections API 문서](https://docs.astro.build/en/guides/content-collections/)
