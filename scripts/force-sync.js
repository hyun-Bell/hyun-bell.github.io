#!/usr/bin/env node

/**
 * 강제 동기화 스크립트
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function forceSync() {
  console.log('🔄 Forcing Notion sync...\n');

  try {
    const dataStorePath = path.join(__dirname, '..', '.astro', 'data-store.json');

    // 메타데이터만 수정 (lastSync 제거)
    try {
      const data = await fs.readFile(dataStorePath, 'utf-8');
      const store = JSON.parse(data);

      if (store.collections?.blog?.meta) {
        delete store.collections.blog.meta.lastSync;
        await fs.writeFile(dataStorePath, JSON.stringify(store, null, 2));
        console.log('✅ Sync timestamp cleared. Next build will fetch fresh data.');
      }
    } catch (error) {
      console.log('ℹ️  No existing cache to clear.', error);
    }

    console.log('\n💡 Run `pnpm dev` or `pnpm build` to sync with Notion.');
  } catch (error) {
    console.error('Error forcing sync:', error);
  }
}

forceSync();
