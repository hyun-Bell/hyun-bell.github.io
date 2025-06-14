#!/usr/bin/env node

/**
 * 이미지 캐시 정리 스크립트
 * 오래된 이미지 메타데이터와 플레이스홀더를 제거합니다.
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';

const CACHE_DIR = '.astro/image-cache';
const METADATA_CACHE_FILE = join(CACHE_DIR, 'metadata.json');
const PLACEHOLDER_CACHE_DIR = join(CACHE_DIR, 'placeholders');

// 기본 최대 캐시 보관 기간 (30일)
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;

async function cleanupImageCache(maxAge = MAX_AGE) {
  console.log('🧹 Starting image cache cleanup...');
  
  try {
    const now = Date.now();
    let cleanedMetadata = 0;
    let cleanedPlaceholders = 0;
    
    // 메타데이터 캐시 정리
    try {
      const metadataExists = await fs.access(METADATA_CACHE_FILE).then(() => true).catch(() => false);
      
      if (metadataExists) {
        const data = await fs.readFile(METADATA_CACHE_FILE, 'utf-8');
        const metadata = JSON.parse(data);
        
        for (const key in metadata) {
          if (now - metadata[key].timestamp > maxAge) {
            delete metadata[key];
            cleanedMetadata++;
          }
        }
        
        if (cleanedMetadata > 0) {
          await fs.writeFile(METADATA_CACHE_FILE, JSON.stringify(metadata, null, 2));
          console.log(`✅ Cleaned ${cleanedMetadata} old metadata entries`);
        }
      }
    } catch (error) {
      console.error('❌ Failed to cleanup metadata cache:', error);
    }
    
    // 플레이스홀더 캐시 정리
    try {
      const placeholderExists = await fs.access(PLACEHOLDER_CACHE_DIR).then(() => true).catch(() => false);
      
      if (placeholderExists) {
        const files = await fs.readdir(PLACEHOLDER_CACHE_DIR);
        
        for (const file of files) {
          const filePath = join(PLACEHOLDER_CACHE_DIR, file);
          const stats = await fs.stat(filePath);
          
          if (now - stats.mtime.getTime() > maxAge) {
            await fs.unlink(filePath);
            cleanedPlaceholders++;
          }
        }
        
        if (cleanedPlaceholders > 0) {
          console.log(`✅ Cleaned ${cleanedPlaceholders} old placeholder files`);
        }
      }
    } catch (error) {
      console.error('❌ Failed to cleanup placeholder cache:', error);
    }
    
    if (cleanedMetadata === 0 && cleanedPlaceholders === 0) {
      console.log('✨ No old cache files found to clean');
    }
    
    console.log('🎉 Image cache cleanup completed');
    
  } catch (error) {
    console.error('❌ Image cache cleanup failed:', error);
    process.exit(1);
  }
}

// CLI 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  const maxAgeArg = process.argv[2];
  const maxAge = maxAgeArg ? parseInt(maxAgeArg) * 24 * 60 * 60 * 1000 : MAX_AGE;
  
  await cleanupImageCache(maxAge);
}

export { cleanupImageCache };