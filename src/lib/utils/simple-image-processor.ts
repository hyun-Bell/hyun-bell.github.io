/**
 * 간단한 이미지 처리 유틸리티
 * 빌드 시간을 최소화하면서 blur placeholder 제공
 */

import type { ImageInfo } from '@/lib/types/notion';

// 기본 blur placeholder (10x10 회색 블러 이미지)
const DEFAULT_BLUR =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAKAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWEREiMxUf/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q==';

// 이미지 URL에서 간단한 메타데이터 추출
export function extractImageMetadata(content: string): ImageInfo[] {
  const images: ImageInfo[] = [];

  // img 태그 찾기 - data-block-id 포함
  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
  let match;

  while ((match = imgRegex.exec(content)) !== null) {
    const url = match[1] || '';
    const fullTag = match[0];

    // alt 텍스트 추출
    const altMatch = fullTag.match(/alt="([^"]*)"/);
    const alt = altMatch ? altMatch[1] : '';

    // block-id 추출
    const blockIdMatch = fullTag.match(/data-block-id="([^"]*)"/);
    const blockId = blockIdMatch ? blockIdMatch[1] : '';

    // Notion 이미지인 경우 기본 크기 설정
    const isNotionImage = url.includes('notion.so') || url.includes('amazonaws.com');

    images.push({
      url,
      alt,
      width: isNotionImage ? 1200 : 800, // 기본값
      height: isNotionImage ? 800 : 600, // 기본값
      caption: alt,
      blurDataURL: DEFAULT_BLUR,
      blockId, // 블록 ID 추가
    });
  }

  return images;
}

// 콘텐츠에 이미지 메타데이터 적용
export function applyImageMetadata(content: string, images: ImageInfo[]): string {
  let processedContent = content;
  let imageIndex = 0;

  // img 태그를 찾아서 메타데이터 추가
  processedContent = processedContent.replace(
    /<img([^>]+)src="([^"]+)"([^>]*)>/g,
    (match, before, src, after) => {
      const imageData = images[imageIndex];
      imageIndex++;

      if (!imageData) return match;

      // 이미지 wrapper로 감싸기
      return `<div class="image-placeholder" style="position: relative; overflow: hidden; background-color: #f5f5f5; aspect-ratio: ${imageData.width}/${imageData.height};">
        <img${before}src="${src}"${after} 
          width="${imageData.width}" 
          height="${imageData.height}"
          style="opacity: 0; transition: opacity 0.3s ease-in-out;"
          onload="this.style.opacity='1'; this.parentElement.style.backgroundColor='transparent';"
          loading="lazy">
      </div>`;
    },
  );

  return processedContent;
}
