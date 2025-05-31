/**
 * Notion 이미지 URL 유틸리티
 */

/**
 * Notion 이미지 URL을 영구 URL로 변환
 * 페이지가 공개되어 있어야 작동합니다
 */
export function convertToPublicNotionImage(url: string, blockId: string): string {
  try {
    // 빈 URL 처리
    if (!url) {
      console.warn('Empty image URL provided');
      return '/images/placeholder.jpg';
    }

    // 이미 변환된 URL인 경우 그대로 반환
    if (url.includes('notion.so/image/')) {
      return url;
    }

    // S3 URL인 경우에만 변환
    if (url.includes('amazonaws.com') || url.includes('secure.notion-static.com')) {
      const encodedUrl = encodeURIComponent(url);
      return `https://www.notion.so/image/${encodedUrl}?table=block&id=${blockId}&cache=v2`;
    }

    // 외부 URL은 그대로 반환
    return url;
  } catch (error) {
    console.error('Image URL conversion error:', error);
    // 에러 발생 시 플레이스홀더 반환
    return '/images/placeholder.jpg';
  }
}

/**
 * Markdown 내의 모든 이미지 URL을 영구 URL로 변환
 */
export function convertMarkdownImages(markdown: string, pageId: string): string {
  try {
    // 이미지 패턴 매칭: ![alt](url)
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;

    return markdown.replace(imageRegex, (match, alt, url) => {
      // S3 URL인 경우에만 변환
      if (url.includes('amazonaws.com') || url.includes('secure.notion-static.com')) {
        const permanentUrl = convertToPublicNotionImage(url, pageId);
        return `![${alt}](${permanentUrl})`;
      }
      return match;
    });
  } catch (error) {
    console.error('Markdown image conversion error:', error);
    // 에러 발생 시 원본 마크다운 반환
    return markdown;
  }
}
