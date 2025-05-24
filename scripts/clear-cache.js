#!/usr/bin/env node

/**
 * 캐시 클리어 스크립트
 */

import { cache } from '../src/lib/utils/cache.js';

async function clearCache() {
  console.log('🧹 Clearing Notion cache...');

  try {
    await cache.clearNamespace('notion');
    console.log('✅ Notion cache cleared successfully');

    const stats = await cache.getStats();
    console.log(`📊 Cache stats:
  - Total files: ${stats.fileCount}
  - Total size: ${(stats.totalSize / 1024).toFixed(2)} KB
  - Namespaces: ${Object.keys(stats.namespaces).join(', ')}`);
  } catch (error) {
    console.error('❌ Failed to clear cache:', error);
    process.exit(1);
  }
}

clearCache();
