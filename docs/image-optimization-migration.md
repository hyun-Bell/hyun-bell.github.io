# 이미지 최적화 시스템 마이그레이션 가이드

## 개요

새로운 이미지 최적화 시스템으로 마이그레이션하여 다음과 같은 개선사항을 제공합니다:

- ✅ 실제 이미지 크기 추출 및 정확한 aspect ratio 유지
- ✅ 경량화된 blur placeholder 생성 (SVG + 작은 JPEG)
- ✅ Intersection Observer 기반 프로그레시브 로딩
- ✅ 강력한 캐싱 전략으로 빌드 시간 최적화
- ✅ 에러 처리 및 fallback 메커니즘
- ✅ Layout shift 완전 방지

## 주요 변경사항

### 1. 새로운 이미지 최적화 엔진

**이전 시스템:**
```typescript
// 기본값 사용, 실제 크기 미추출
width: 1200, height: 800
```

**새로운 시스템:**
```typescript
// 실제 이미지에서 메타데이터 추출
const metadata = await extractMetadata(imageUrl);
// width: 실제_폭, height: 실제_높이, aspectRatio: 정확한_비율
```

### 2. 개선된 플레이스홀더 생성

**이전:** 20KB+ 블러 이미지
**개선:** 2KB 미만 최적화된 블러 + SVG 폴백

### 3. 프로그레시브 로딩

**이전:** 즉시 모든 이미지 로드
**개선:** Intersection Observer로 뷰포트 진입 시에만 로드

## 마이그레이션 단계

### 1. 캐시 정리 (선택사항)
```bash
# 기존 이미지 캐시 정리
pnpm image:cleanup

# 또는 강제 정리 (7일 이상된 캐시만)
pnpm image:cleanup:force
```

### 2. 새로운 시스템 확인

빌드 시 다음과 같은 로그가 표시되어야 합니다:
```
🚀 Starting Notion content sync...
📊 Found X published posts in Notion
Processing Y images for optimization...
✅ Image optimization completed for Y images
```

### 3. 이미지 로딩 확인

개발 환경에서 브라우저 콘솔에 다음 로그가 표시됩니다:
```
🖼️ Progressive Images: X/Y loaded
✅ All progressive images loaded
```

## 사용 가능한 명령어

```bash
# 이미지 캐시 정리 (30일 이상된 항목)
pnpm image:cleanup

# 이미지 캐시 강제 정리 (7일 이상된 항목)
pnpm image:cleanup:force

# 기존 명령어들도 그대로 사용 가능
pnpm dev
pnpm build
pnpm preview
```

## 성능 개선사항

### 빌드 성능
- **캐싱**: 변경되지 않은 이미지는 재처리하지 않음
- **배치 처리**: 동시 처리 제한으로 메모리 사용량 최적화
- **타임아웃 방지**: 경량화된 메타데이터 추출로 빌드 안정성 향상

### 런타임 성능
- **Layout Shift 방지**: 정확한 aspect ratio로 CLS = 0
- **지연 로딩**: 필요한 이미지만 로드하여 초기 로딩 시간 단축
- **부드러운 전환**: 400ms 페이드 인 애니메이션
- **에러 처리**: 로드 실패 시 우아한 fallback

## 호환성

### 브라우저 지원
- **Intersection Observer**: 모든 모던 브라우저
- **Fallback**: 지원하지 않는 브라우저에서는 즉시 로드

### 기존 컴포넌트
- `NotionImage.astro`: 자동으로 새로운 시스템 사용
- 기존 이미지 태그: 점진적으로 업그레이드됨

## 문제 해결

### 이미지가 로드되지 않는 경우
1. 브라우저 콘솔에서 에러 확인
2. 네트워크 탭에서 이미지 요청 상태 확인
3. `pnpm image:cleanup` 실행 후 재빌드

### 빌드 시간이 늘어난 경우
1. 첫 빌드는 모든 이미지 처리로 인해 느릴 수 있음
2. 이후 빌드는 캐시로 인해 더 빨라짐
3. `pnpm image:cleanup:force`로 오래된 캐시 정리

### 메모리 부족 에러
1. `src/lib/image/optimizer.ts`에서 `MAX_CONCURRENT_PROCESSING` 값 감소
2. 배치 크기 조정: `src/lib/content/loader.ts`의 `BATCH_SIZE` 감소

## 개발자 도구

### 이미지 로딩 통계 (개발 환경)
브라우저 콘솔에서 실시간 로딩 통계를 확인할 수 있습니다.

### 캐시 상태 확인
```bash
# 캐시 디렉토리 확인
ls -la .astro/image-cache/

# 메타데이터 캐시 내용 확인
cat .astro/image-cache/metadata.json | jq .
```

## 결론

새로운 이미지 최적화 시스템은 사용자 경험과 개발자 경험을 모두 개선합니다:

- **사용자**: 더 빠른 로딩, Layout Shift 없음, 부드러운 전환
- **개발자**: 안정적인 빌드, 효율적인 캐싱, 명확한 로깅

기존 기능은 그대로 유지되면서 성능만 향상되었으므로, 별도의 코드 변경 없이 바로 사용할 수 있습니다.