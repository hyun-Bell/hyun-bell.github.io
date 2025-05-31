#!/usr/bin/env node

/**
 * 동기화 상태 확인 스크립트
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function checkSyncStatus() {
  console.log('📊 Notion Sync Status\n');

  try {
    // Astro의 data store 위치
    const dataStorePath = path.join(__dirname, '..', '.astro', 'data-store.json');

    try {
      const data = await fs.readFile(dataStorePath, 'utf-8');
      const store = JSON.parse(data);

      // 블로그 메타데이터
      const blogMeta = store.collections?.blog?.meta || {};
      const lastSyncStr = blogMeta.lastSync;
      const lastSync = lastSyncStr ? parseInt(lastSyncStr, 10) : null;
      const syncSummaryStr = blogMeta.lastSyncSummary;
      const syncSummary = syncSummaryStr ? JSON.parse(syncSummaryStr) : {};

      if (lastSync) {
        const syncDate = new Date(lastSync);
        const ageMinutes = Math.round((Date.now() - lastSync) / 1000 / 60);

        console.log('🕒 Last Sync:', syncDate.toLocaleString());
        console.log(`⏱️  Age: ${ageMinutes} minutes ago`);
        console.log('\n📈 Sync Summary:');
        console.log(`  ✅ Updated: ${syncSummary.updated || 0}`);
        console.log(`  ⏭️  Skipped: ${syncSummary.skipped || 0}`);
        console.log(`  ❌ Deleted: ${syncSummary.deleted || 0}`);
        console.log(`  📚 Total: ${syncSummary.total || 0}`);
      } else {
        console.log('ℹ️  No sync history found');
      }

      // 포스트 수
      const postCount = Object.keys(store.collections?.blog?.entries || {}).length;
      console.log(`\n📝 Cached Posts: ${postCount}`);
    } catch (error) {
      console.log('ℹ️  No cache data found. Run dev server first.', error);
    }
  } catch (error) {
    console.error('Error reading sync status:', error);
  }
}

checkSyncStatus();
