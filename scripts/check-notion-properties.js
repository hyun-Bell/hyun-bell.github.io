#!/usr/bin/env node

/**
 * Notion 데이터베이스 속성 확인 스크립트
 * - 데이터베이스 연결 테스트
 * - 속성 이름 및 타입 확인
 * - 데이터 샘플 출력
 */

import { Client } from '@notionhq/client';
import dotenv from 'dotenv';

// 환경 변수 로드
dotenv.config();

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

/**
 * 데이터베이스 속성 확인
 */
async function checkDatabase(databaseId, name) {
  console.log(`\n📊 Checking ${name} Database...`);
  console.log(`ID: ${databaseId}`);

  try {
    // 데이터베이스 메타데이터 가져오기
    const database = await notion.databases.retrieve({
      database_id: databaseId,
    });

    console.log(`✅ Database found: ${database.title[0]?.plain_text || 'Untitled'}`);
    console.log('\n📋 Properties:');

    // 속성 정보 출력
    const properties = Object.entries(database.properties);
    properties.forEach(([propName, propInfo]) => {
      console.log(`  - ${propName}: ${propInfo.type}`);

      // 선택 옵션이 있는 경우 출력
      if (propInfo.type === 'select' && propInfo.select?.options) {
        const options = propInfo.select.options.map((opt) => opt.name);
        console.log(`    Options: ${options.join(', ')}`);
      }
      if (propInfo.type === 'multi_select' && propInfo.multi_select?.options) {
        const options = propInfo.multi_select.options.map((opt) => opt.name);
        console.log(`    Options: ${options.join(', ')}`);
      }
    });

    // 샘플 데이터 가져오기
    console.log('\n📄 Sample Data (First 3 items):');
    const response = await notion.databases.query({
      database_id: databaseId,
      page_size: 3,
    });

    response.results.forEach((page, index) => {
      console.log(`\n  Item ${index + 1}:`);

      // 주요 속성만 출력
      const props = page.properties;

      // Title 찾기
      const titleProp = Object.entries(props).find(([, prop]) => prop.type === 'title');
      if (titleProp) {
        const [propName, propValue] = titleProp;
        const title = propValue.title?.[0]?.plain_text || 'No title';
        console.log(`    ${propName}: ${title}`);
      }

      // Published/Checkbox 속성
      Object.entries(props).forEach(([propName, propValue]) => {
        if (propValue.type === 'checkbox') {
          console.log(`    ${propName}: ${propValue.checkbox}`);
        }
      });

      // Date 속성
      Object.entries(props).forEach(([propName, propValue]) => {
        if (propValue.type === 'date' && propValue.date) {
          console.log(`    ${propName}: ${propValue.date.start}`);
        }
      });
    });

    return true;
  } catch (error) {
    console.error(`❌ Error checking database: ${error.message}`);
    return false;
  }
}

/**
 * 메인 함수
 */
async function main() {
  console.log('🔍 Notion Properties Checker\n');

  // 환경 변수 확인
  if (!process.env.NOTION_TOKEN) {
    console.error('❌ NOTION_TOKEN not found in environment variables');
    process.exit(1);
  }

  const databases = [
    {
      id: process.env.NOTION_DATABASE_ID,
      name: 'Blog Posts',
      required: true,
    },
    {
      id: process.env.NOTION_PROJECTS_DATABASE_ID,
      name: 'Projects',
      required: false,
    },
    {
      id: process.env.NOTION_SNIPPETS_DATABASE_ID,
      name: 'Code Snippets',
      required: false,
    },
  ];

  let hasError = false;

  for (const db of databases) {
    if (!db.id) {
      if (db.required) {
        console.error(`❌ ${db.name} database ID not found (required)`);
        hasError = true;
      } else {
        console.log(`ℹ️  ${db.name} database ID not found (optional)`);
      }
      continue;
    }

    const success = await checkDatabase(db.id, db.name);
    if (!success && db.required) {
      hasError = true;
    }
  }

  console.log('\n' + '='.repeat(50));

  if (hasError) {
    console.error('\n❌ Some checks failed. Please verify your Notion configuration.');
    process.exit(1);
  } else {
    console.log('\n✅ All checks passed! Your Notion setup is correctly configured.');

    // 유용한 정보 출력
    console.log('\n💡 Tips:');
    console.log('  - Make sure all required properties exist in your Notion databases');
    console.log('  - Property names are case-sensitive');
    console.log('  - The script supports both English and Korean property names');
    console.log('  - Run "pnpm cache:clear" if you need to refresh cached data');
  }
}

// 스크립트 실행
main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
