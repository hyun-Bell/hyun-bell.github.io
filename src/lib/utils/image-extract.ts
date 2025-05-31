/**
 * 마크다운에서 첫 번째 이미지 URL 추출
 */
export function extractFirstImage(markdown: string): string | null {
  if (!markdown) return null;

  // 마크다운 이미지 패턴: ![alt](url)
  const markdownImageRegex = /!\[.*?\]\((https?:\/\/[^\\)]+)\)/;

  // HTML img 태그 패턴: <img src="url" />
  const htmlImageRegex = /<img[^>]+src=["']([^"']+)["']/i;

  // 마크다운 이미지 먼저 확인
  const markdownMatch = markdown.match(markdownImageRegex);
  if (markdownMatch?.[1]) {
    return markdownMatch[1];
  }

  // HTML 이미지 확인
  const htmlMatch = markdown.match(htmlImageRegex);
  if (htmlMatch?.[1]) {
    return htmlMatch[1];
  }

  return null;
}

/**
 * 이미지가 히어로 이미지인지 판단
 * (컨텐츠 상단 500자 이내에 있는 경우)
 */
export function isHeroImage(markdown: string, imageUrl: string): boolean {
  const first500Chars = markdown.substring(0, 500);
  return first500Chars.includes(imageUrl);
}
