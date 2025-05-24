#!/usr/bin/env node

/**
 * 빌드 후 보안 체크 스크립트
 * - 환경 변수 노출 검사
 * - 민감한 정보 포함 여부 확인
 */

import { promises as fs } from 'fs';
import path from 'path';

// 검사할 패턴들
const SENSITIVE_PATTERNS = [
  // API 키 패턴
  /NOTION_TOKEN['":\s]*['"](secret_[A-Za-z0-9]+)['"]/gi,
  /API_KEY['":\s]*['"]([\w-]+)['"]/gi,
  /SECRET['":\s]*['"]([\w-]+)['"]/gi,

  // 이메일 패턴 (환경 변수가 아닌 하드코딩된 경우)
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,

  // Private 키 패턴
  /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/,

  // GitHub Token
  /ghp_[A-Za-z0-9_]{36}/g,
  /github_pat_[A-Za-z0-9_]{82}/g,
];

// 환경 변수 이름들 (이것들은 빌드된 파일에 있으면 안됨)
const FORBIDDEN_ENV_VARS = [
  'NOTION_TOKEN',
  'NOTION_DATABASE_ID',
  'NOTION_PAGES_DATABASE_ID',
  'NOTION_PROJECTS_DATABASE_ID',
  'NOTION_SNIPPETS_DATABASE_ID',
];

// 제외할 디렉토리
const EXCLUDE_DIRS = [
  'node_modules',
  '.git',
  '.astro',
  'scripts',
  'src', // 소스 코드는 검사하지 않음
];

/**
 * 파일이 검사 대상인지 확인
 */
function shouldCheckFile(filePath) {
  const ext = path.extname(filePath);
  return ['.js', '.html', '.json', '.css'].includes(ext);
}

/**
 * 디렉토리를 재귀적으로 검사
 */
async function checkDirectory(dir) {
  const issues = [];

  try {
    const files = await fs.readdir(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = await fs.stat(filePath);

      if (stat.isDirectory()) {
        // 제외 디렉토리인지 확인
        if (!EXCLUDE_DIRS.includes(file)) {
          const subIssues = await checkDirectory(filePath);
          issues.push(...subIssues);
        }
      } else if (stat.isFile() && shouldCheckFile(filePath)) {
        const fileIssues = await checkFile(filePath);
        issues.push(...fileIssues);
      }
    }
  } catch (error) {
    console.error(`Error checking directory ${dir}:`, error.message);
  }

  return issues;
}

/**
 * 파일 내용 검사
 */
async function checkFile(filePath) {
  const issues = [];

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const relativePath = path.relative(process.cwd(), filePath);

    // 민감한 패턴 검사
    for (const pattern of SENSITIVE_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        issues.push({
          file: relativePath,
          type: 'sensitive_pattern',
          pattern: pattern.toString(),
          matches: [...new Set(matches)], // 중복 제거
        });
      }
    }

    // 금지된 환경 변수 검사
    for (const envVar of FORBIDDEN_ENV_VARS) {
      if (content.includes(envVar)) {
        // 실제 값이 포함되어 있는지 더 정확히 검사
        // \s는 불필요한 escape이므로 제거, 그리고 따옴표는 선택적으로 허용
        // 따옴표, 콜론, 공백을 선택적으로 허용
        const valuePattern = new RegExp(`${envVar}['": ]*['"]?((?!PUBLIC_)[^'"]+)['"]?`, 'gi');
        const matches = content.match(valuePattern);
        if (matches) {
          issues.push({
            file: relativePath,
            type: 'env_var_exposed',
            envVar,
            matches,
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error checking file ${filePath}:`, error.message);
  }

  return issues;
}

/**
 * 메인 함수
 */
async function main() {
  console.log('🔍 Starting security check...\n');

  const distDir = path.join(process.cwd(), 'dist');

  // dist 디렉토리 존재 확인
  try {
    await fs.access(distDir);
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    console.log('ℹ️  No dist directory found. Skipping security check.');
    process.exit(0);
  }

  // 보안 검사 실행
  const issues = await checkDirectory(distDir);

  if (issues.length === 0) {
    console.log('✅ Security check passed! No sensitive information found in build output.\n');
    process.exit(0);
  } else {
    console.error('❌ Security check failed! Found potential security issues:\n');

    // 이슈 타입별로 그룹화
    const groupedIssues = issues.reduce((acc, issue) => {
      const key = issue.type;
      if (!acc[key]) acc[key] = [];
      acc[key].push(issue);
      return acc;
    }, {});

    // 이슈 출력
    for (const [type, typeIssues] of Object.entries(groupedIssues)) {
      console.error(`\n${type.toUpperCase().replace(/_/g, ' ')}:`);

      for (const issue of typeIssues) {
        console.error(`  - File: ${issue.file}`);
        if (issue.matches) {
          console.error(`    Found: ${issue.matches.join(', ')}`);
        }
        if (issue.envVar) {
          console.error(`    Environment variable: ${issue.envVar}`);
        }
      }
    }

    console.error('\n⚠️  Please review and fix these issues before deploying.\n');
    process.exit(1);
  }
}

// 스크립트 실행
main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
