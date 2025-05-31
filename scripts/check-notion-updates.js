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

// Notion 클라이언트
const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

async function checkForUpdates() {
  try {
    // 마지막 업데이트 시간 읽기
    let lastUpdate = null;
    try {
      const data = await fs.readFile(LAST_UPDATE_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      lastUpdate = parsed.timestamp;
      console.log(`Last update: ${new Date(lastUpdate).toISOString()}`);
    } catch (error) {
      console.log('No previous update timestamp found - first run', error);
    }

    // Notion에서 최신 수정 시간 확인
    console.log('Checking Notion for updates...');
    const response = await notion.databases.query({
      database_id: process.env.NOTION_DATABASE_ID,
      sorts: [
        {
          timestamp: 'last_edited_time',
          direction: 'descending',
        },
      ],
      page_size: 1,
      filter: {
        property: 'Published',
        checkbox: {
          equals: true,
        },
      },
    });

    if (response.results.length === 0) {
      console.log('No published pages found in database');
      console.log('No updates detected');
      process.exit(0);
    }

    const latestPage = response.results[0];
    const latestUpdate = latestPage.last_edited_time;
    console.log(`Latest update in Notion: ${new Date(latestUpdate).toISOString()}`);

    // 페이지 정보 출력
    const pageTitle =
      latestPage.properties.Title?.title?.[0]?.plain_text ||
      latestPage.properties.Name?.title?.[0]?.plain_text ||
      'Untitled';
    console.log(`Latest updated page: "${pageTitle}"`);

    // 업데이트 필요 여부 확인
    const hasUpdates = !lastUpdate || new Date(latestUpdate) > new Date(lastUpdate);

    if (hasUpdates) {
      // 새로운 타임스탬프 저장
      await fs.mkdir(path.dirname(LAST_UPDATE_FILE), { recursive: true });
      await fs.writeFile(
        LAST_UPDATE_FILE,
        JSON.stringify(
          {
            timestamp: latestUpdate,
            pageTitle: pageTitle,
            checkedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
      );

      console.log('\n✅ Updates detected!');
      console.log(
        `Time difference: ${lastUpdate ? Math.round((new Date(latestUpdate) - new Date(lastUpdate)) / 1000 / 60) + ' minutes' : 'N/A (first run)'}`,
      );
    } else {
      console.log('\nℹ️  No updates detected');
      const timeSinceLastUpdate = Math.round(
        (Date.now() - new Date(latestUpdate)) / 1000 / 60 / 60,
      );
      console.log(`Last content update was ${timeSinceLastUpdate} hours ago`);
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error checking for updates:', error.message);

    // 상세 에러 정보
    if (error.code === 'unauthorized') {
      console.error('Invalid Notion token');
    } else if (error.code === 'object_not_found') {
      console.error('Database not found - check NOTION_DATABASE_ID');
    } else {
      console.error('Stack trace:', error.stack);
    }

    // 에러 시에도 빌드는 진행 (안전장치)
    console.log('\n✅ Updates detected! (due to error - proceeding with build)');
    process.exit(0);
  }
}

// 환경 변수 검증
if (!process.env.NOTION_TOKEN || !process.env.NOTION_DATABASE_ID) {
  console.error('❌ Missing required environment variables');
  console.error('Required: NOTION_TOKEN, NOTION_DATABASE_ID');
  console.error('\nCurrent environment:');
  console.error(`NOTION_TOKEN: ${process.env.NOTION_TOKEN ? '✓ Set' : '✗ Missing'}`);
  console.error(`NOTION_DATABASE_ID: ${process.env.NOTION_DATABASE_ID ? '✓ Set' : '✗ Missing'}`);
  process.exit(1);
}

console.log('🔍 Notion Update Checker');
console.log('========================');
console.log(`Database ID: ${process.env.NOTION_DATABASE_ID}`);
console.log(`Current time: ${new Date().toISOString()}\n`);

// 실행
checkForUpdates().catch((error) => {
  console.error('Unexpected error:', error);
  // 예상치 못한 에러여도 빌드는 진행
  console.log('\n✅ Updates detected! (due to unexpected error)');
  process.exit(0);
});
