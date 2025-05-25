import { getNotionClient } from '../src/lib/notion/client.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LAST_UPDATE_FILE = path.join(__dirname, '../.notion-last-update.json');

async function checkForUpdates() {
  const client = getNotionClient();

  try {
    // 마지막 업데이트 시간 읽기
    let lastUpdate = null;
    try {
      const data = await fs.readFile(LAST_UPDATE_FILE, 'utf-8');
      lastUpdate = JSON.parse(data).timestamp;
    } catch (error) {
      console.log('No previous update timestamp found', error);
    }

    // Notion에서 최신 수정 시간 확인
    const database = await client.notion.databases.query({
      database_id: process.env.NOTION_DATABASE_ID,
      sorts: [
        {
          property: 'last_edited_time',
          direction: 'descending',
        },
      ],
      page_size: 1,
    });

    if (database.results.length === 0) {
      console.log('No pages found');
      process.exit(0);
    }

    const latestUpdate = database.results[0].last_edited_time;

    // 업데이트 필요 여부 확인
    const hasUpdates = !lastUpdate || new Date(latestUpdate) > new Date(lastUpdate);

    if (hasUpdates) {
      // 새로운 타임스탬프 저장
      await fs.writeFile(LAST_UPDATE_FILE, JSON.stringify({ timestamp: latestUpdate }, null, 2));

      console.log('Updates detected!');
      console.log(`::set-output name=has_updates::true`);
    } else {
      console.log('No updates detected');
      console.log(`::set-output name=has_updates::false`);
    }
  } catch (error) {
    console.error('Error checking for updates:', error);
    // 에러 시에도 빌드 진행 (안전장치)
    console.log(`::set-output name=has_updates::true`);
  }
}

checkForUpdates();
