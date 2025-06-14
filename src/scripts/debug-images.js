/**
 * 이미지 처리 디버깅 스크립트
 */

import { promises as fs } from 'fs';
import path from 'path';

const METADATA_CACHE_FILE = '.astro/image-metadata.json';
const DATA_STORE_FILE = '.astro/data-store.json';

async function debugImages() {
  console.log('🔍 Image Processing Debug\n');
  
  // 1. 메타데이터 캐시 확인
  console.log('1. Checking image metadata cache...');
  try {
    const metadataContent = await fs.readFile(METADATA_CACHE_FILE, 'utf-8');
    const metadata = JSON.parse(metadataContent);
    const entries = Object.entries(metadata);
    
    console.log(`   Found ${entries.length} cached images`);
    
    if (entries.length > 0) {
      console.log('\n   Sample entries:');
      entries.slice(0, 3).forEach(([key, value]) => {
        console.log(`   - Key: ${key.substring(0, 16)}...`);
        console.log(`     Width: ${value.width}, Height: ${value.height}`);
        console.log(`     Has blur: ${!!value.blurDataURL}`);
        console.log(`     Blur length: ${value.blurDataURL?.length || 0} chars\n`);
      });
    }
  } catch (error) {
    console.log('   ❌ No metadata cache found');
  }
  
  // 2. Data store 확인
  console.log('\n2. Checking data store...');
  try {
    const dataStoreContent = await fs.readFile(DATA_STORE_FILE, 'utf-8');
    const dataStore = JSON.parse(dataStoreContent);
    
    console.log(`   Found ${dataStore.entries.length} posts in data store`);
    
    const postsWithImages = dataStore.entries.filter(
      entry => entry.data.images && entry.data.images.length > 0
    );
    
    console.log(`   Posts with images: ${postsWithImages.length}`);
    
    if (postsWithImages.length > 0) {
      console.log('\n   Posts with images:');
      postsWithImages.forEach(post => {
        console.log(`   - ${post.data.title}`);
        console.log(`     Images: ${post.data.images.length}`);
        post.data.images.forEach((img, idx) => {
          console.log(`     ${idx + 1}. ${img.width}x${img.height}, blur: ${!!img.blurDataURL}`);
        });
        console.log('');
      });
    }
  } catch (error) {
    console.log('   ❌ No data store found');
  }
  
  // 3. 캐시 디렉토리 확인
  console.log('\n3. Checking cache directories...');
  const cacheDir = '.astro/image-cache';
  try {
    const files = await fs.readdir(cacheDir);
    console.log(`   Found ${files.length} files in image cache`);
  } catch (error) {
    console.log('   ❌ No image cache directory found');
  }
}

debugImages().catch(console.error);