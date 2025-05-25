#!/usr/bin/env node

/**
 * Notion 업데이트 확인 스크립트
 * GitHub Actions에서 실행되어 콘텐츠 변경 감지
 */

import { Client } from '@notionhq/client';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// 환경 변수 로드
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LAST_UPDATE_FILE = path.join(__dirname, '../.notion-last-update.json');

// Notion 클라이언트 직접 생성
const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

async function checkForUpdates() {
  try {
    // 마지막 업데이트 시간 읽기
    let lastUpdate = null;
    try {
      const data = await fs.readFile(LAST_UPDATE_FILE, 'utf-8');
      lastUpdate = JSON.parse(data).timestamp;
      console.log('Last update:', lastUpdate);
    } catch (error) {
      console.log('No previous update timestamp found', error);
    }

    // Notion에서 최신 수정 시간 확인
    const response = await notion.databases.query({
      database_id: process.env.NOTION_DATABASE_ID,
      sorts: [
        {
          timestamp: 'last_edited_time',
          direction: 'descending',
        },
      ],
      page_size: 1,
    });

    if (response.results.length === 0) {
      console.log('No pages found in database');
      console.log('::set-output name=has_updates::false');
      process.exit(0);
    }

    const latestPage = response.results[0];
    const latestUpdate = latestPage.last_edited_time;
    console.log('Latest update in Notion:', latestUpdate);

    // 업데이트 필요 여부 확인
    const hasUpdates = !lastUpdate || new Date(latestUpdate) > new Date(lastUpdate);

    if (hasUpdates) {
      // 새로운 타임스탬프 저장
      await fs.mkdir(path.dirname(LAST_UPDATE_FILE), { recursive: true });
      await fs.writeFile(LAST_UPDATE_FILE, JSON.stringify({ timestamp: latestUpdate }, null, 2));

      console.log('✅ Updates detected!');
      console.log('::set-output name=has_updates::true');
    } else {
      console.log('ℹ️  No updates detected');
      console.log('::set-output name=has_updates::false');
    }
  } catch (error) {
    console.error('❌ Error checking for updates:', error.message);
    // 에러 시에도 빌드 진행 (안전장치)
    console.log('::set-output name=has_updates::true');
    process.exit(1);
  }
}

// 환경 변수 검증
if (!process.env.NOTION_TOKEN || !process.env.NOTION_DATABASE_ID) {
  console.error('❌ Missing required environment variables');
  console.error('Required: NOTION_TOKEN, NOTION_DATABASE_ID');
  process.exit(1);
}

// 실행
checkForUpdates().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
