/**
 * 날짜 관련 유틸리티 함수
 */

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
 * ISO 날짜 문자열로 변환
 */
export function toISOString(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString();
}
