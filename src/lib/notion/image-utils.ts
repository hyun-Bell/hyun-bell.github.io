/**
 * Notion 이미지 URL 유틸리티
 */

import { promises as fsPromises } from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import crypto from 'crypto';

export interface ImageMetadata {
  width: number;
  height: number;
  blurDataURL: string;
  format: string;
}

export interface ProcessedImage {
  url: string;
  metadata: ImageMetadata;
}

// 이미지 캐시 디렉토리
const IMAGE_CACHE_DIR = '.astro/image-cache';
const METADATA_CACHE_FILE = '.astro/image-metadata.json';

// 메타데이터 캐시
let metadataCache: Record<string, ImageMetadata> = {};

/**
 * 캐시 디렉토리 생성
 */
async function ensureCacheDir() {
  await fsPromises.mkdir(IMAGE_CACHE_DIR, { recursive: true });
  await fsPromises.mkdir(path.dirname(METADATA_CACHE_FILE), { recursive: true });
}

/**
 * 메타데이터 캐시 로드
 */
async function loadMetadataCache() {
  try {
    const data = await fsPromises.readFile(METADATA_CACHE_FILE, 'utf-8');
    metadataCache = JSON.parse(data);
  } catch {
    metadataCache = {};
  }
}

/**
 * 메타데이터 캐시 저장
 */
async function saveMetadataCache() {
  await fsPromises.writeFile(METADATA_CACHE_FILE, JSON.stringify(metadataCache, null, 2));
}

/**
 * URL에서 이미지 다운로드
 */
async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * 이미지에서 blur placeholder 생성
 */
async function generateBlurPlaceholder(buffer: Buffer): Promise<string> {
  console.log('[generateBlurPlaceholder] Starting blur generation...');
  
  // 작은 크기로 리사이즈하고 blur 적용
  const blurred = await sharp(buffer)
    .resize(10, 10, { fit: 'inside' })
    .blur()
    .jpeg({ quality: 50 })
    .toBuffer();
  
  const blurDataURL = `data:image/jpeg;base64,${blurred.toString('base64')}`;
  console.log('[generateBlurPlaceholder] Generated blur placeholder:', blurDataURL.substring(0, 50) + '...');
  
  return blurDataURL;
}

/**
 * 이미지 처리 및 메타데이터 추출
 */
export async function processNotionImage(url: string, blockId: string): Promise<ProcessedImage> {
  console.log('[processNotionImage] Processing image:', url);
  console.log('[processNotionImage] Block ID:', blockId);
  
  // 영구 URL로 변환
  const permanentUrl = convertToPublicNotionImage(url, blockId);
  console.log('[processNotionImage] Permanent URL:', permanentUrl);
  
  // 캐시 디렉토리 확인
  await ensureCacheDir();
  
  // 캐시 키 생성
  const cacheKey = crypto.createHash('md5').update(permanentUrl).digest('hex');
  console.log('[processNotionImage] Cache key:', cacheKey);
  
  // 캐시 확인
  await loadMetadataCache();
  if (metadataCache[cacheKey]) {
    console.log('[processNotionImage] Found in cache:', cacheKey);
    return {
      url: permanentUrl,
      metadata: metadataCache[cacheKey]
    };
  }
  console.log('[processNotionImage] Not in cache, processing...');
  
  try {
    // 이미지 다운로드
    const buffer = await downloadImage(url);
    
    // Sharp로 메타데이터 추출
    const image = sharp(buffer);
    const metadata = await image.metadata();
    
    if (!metadata.width || !metadata.height) {
      throw new Error('Unable to extract image dimensions');
    }
    
    // blur placeholder 생성
    const blurDataURL = await generateBlurPlaceholder(buffer);
    
    // 메타데이터 저장
    const imageMetadata: ImageMetadata = {
      width: metadata.width,
      height: metadata.height,
      blurDataURL,
      format: metadata.format || 'jpeg'
    };
    
    console.log('[processNotionImage] Generated metadata:', {
      width: imageMetadata.width,
      height: imageMetadata.height,
      blurDataURLLength: imageMetadata.blurDataURL.length,
      format: imageMetadata.format
    });
    
    // 캐시에 저장
    metadataCache[cacheKey] = imageMetadata;
    await saveMetadataCache();
    console.log('[processNotionImage] Saved to cache');
    
    return {
      url: permanentUrl,
      metadata: imageMetadata
    };
  } catch (error) {
    console.error(`Failed to process image ${url}:`, error);
    // 에러 시 기본값 반환
    return {
      url: permanentUrl,
      metadata: {
        width: 800,
        height: 600,
        blurDataURL: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAKAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWEREiMxUf/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q==',
        format: 'jpeg'
      }
    };
  }
}

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

/**
 * 마크다운에서 이미지 정보 추출
 */
export interface ExtractedImage {
  url: string;
  alt: string;
  originalUrl: string;
}

export function extractImagesFromMarkdown(markdown: string): ExtractedImage[] {
  const images: ExtractedImage[] = [];
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  
  let match;
  while ((match = imageRegex.exec(markdown)) !== null) {
    const extracted = {
      url: match[2] || '',
      alt: match[1] || '',
      originalUrl: match[2] || ''
    };
    images.push(extracted);
    console.log('[extractImagesFromMarkdown] Found image:', extracted);
  }
  
  console.log(`[extractImagesFromMarkdown] Total images found: ${images.length}`);
  return images;
}

/**
 * HTML에서 이미지 정보 추출
 */
export function extractImagesFromHTML(html: string): ExtractedImage[] {
  const images: ExtractedImage[] = [];
  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*(?:alt="([^"]*)")?[^>]*>/g;
  
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    images.push({
      url: match[1] || '',
      alt: match[2] || '',
      originalUrl: match[1] || ''
    });
  }
  
  return images;
}

/**
 * Notion 이미지 URL에서 블록 ID 추출
 */
export function extractBlockIdFromUrl(url: string): string {
  // URL 패턴: https://www.notion.so/image/...?table=block&id=BLOCK_ID&cache=v2
  const idMatch = url.match(/[?&]id=([a-f0-9-]+)/);
  if (idMatch && idMatch[1]) {
    return idMatch[1];
  }
  
  // 기본값으로 URL의 해시를 사용
  return crypto.createHash('md5').update(url).digest('hex').substring(0, 36);
}
