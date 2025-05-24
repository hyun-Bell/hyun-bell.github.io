/**
 * 문자열 유틸리티 함수
 */

/**
 * 텍스트를 URL 친화적인 slug로 변환
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s가-힣-]/g, '') // 한글, 영문, 숫자, 공백, 하이픈만 허용
    .replace(/[\s_-]+/g, '-') // 공백, 언더스코어를 하이픈으로
    .replace(/^-+|-+$/g, ''); // 시작과 끝의 하이픈 제거
}

/**
 * 날짜를 포맷팅
 */
export function formatDate(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  },
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ko-KR', options);
}

/**
 * 상대 시간 표시 (예: 3일 전)
 */
export function getRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  const units = [
    { name: '년', seconds: 31536000 },
    { name: '개월', seconds: 2592000 },
    { name: '주', seconds: 604800 },
    { name: '일', seconds: 86400 },
    { name: '시간', seconds: 3600 },
    { name: '분', seconds: 60 },
  ];

  for (const unit of units) {
    const interval = Math.floor(diffInSeconds / unit.seconds);
    if (interval >= 1) {
      return `${interval}${unit.name} 전`;
    }
  }

  return '방금 전';
}

/**
 * 읽기 시간 계산 (한글 기준)
 */
export function calculateReadingTime(text: string): number {
  const wordsPerMinute = 500; // 한국어 평균 읽기 속도
  const wordCount = text.trim().length; // 한글은 글자 수로 계산
  return Math.ceil(wordCount / wordsPerMinute);
}

/**
 * 텍스트 요약 (미리보기용)
 */
export function truncate(text: string, maxLength: number = 150): string {
  if (text.length <= maxLength) return text;

  const truncated = text.slice(0, maxLength);
  const lastSpaceIndex = truncated.lastIndexOf(' ');

  return lastSpaceIndex > 0 ? truncated.slice(0, lastSpaceIndex) + '...' : truncated + '...';
}
