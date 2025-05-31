#!/usr/bin/env node

/**
 * 동기화 상태 확인 스크립트
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function checkSync() {
  console.log('📊 Checking Astro content store...\n');

  try {
    const dataStorePath = path.join(__dirname, '..', '.astro', 'data-store.json');

    try {
      const stats = await fs.stat(dataStorePath);
      const data = await fs.readFile(dataStorePath, 'utf-8');
      const store = JSON.parse(data);

      const blogEntries = Object.keys(store.collections?.blog?.entries || {});
      const projectEntries = Object.keys(store.collections?.projects?.entries || {});
      const snippetEntries = Object.keys(store.collections?.snippets?.entries || {});

      console.log('📝 Content Statistics:');
      console.log(`  Blog posts: ${blogEntries.length}`);
      console.log(`  Projects: ${projectEntries.length}`);
      console.log(`  Snippets: ${snippetEntries.length}`);
      console.log(`\n📅 Last modified: ${stats.mtime.toLocaleString()}`);
      console.log(`📦 Store size: ${(stats.size / 1024).toFixed(2)} KB`);
    } catch (error) {
      console.log('ℹ️  No content store found. Run `pnpm dev` first.', error);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkSync();
