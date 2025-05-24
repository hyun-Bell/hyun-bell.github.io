#!/usr/bin/env node

/**
 * 캐시 클리어 스크립트
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function clearCache() {
  console.log('🧹 Clearing Notion cache...');

  try {
    const cacheDir = path.join(__dirname, '..', '.astro', 'cache');

    // 캐시 디렉토리가 있는지 확인
    try {
      await fs.access(cacheDir);
      // Notion 네임스페이스 캐시 파일들 찾기
      const files = await fs.readdir(cacheDir);
      const notionFiles = files.filter((file) => file.startsWith('notion-'));

      // 파일 삭제
      for (const file of notionFiles) {
        await fs.unlink(path.join(cacheDir, file));
      }

      console.log(`✅ Deleted ${notionFiles.length} cache files`);
      // eslint-disable-next-line no-unused-vars
    } catch (error) {
      console.log('ℹ️  No cache directory found or already empty');
    }

    console.log('✅ Notion cache cleared successfully');
  } catch (error) {
    console.error('❌ Failed to clear cache:', error);
    process.exit(1);
  }
}

clearCache();
