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
  // API 키 패턴 (실제 값만 검사)
  /secret_[A-Za-z0-9_]{32,}/gi,
  /sk_live_[A-Za-z0-9_]{24,}/gi,
  /pk_live_[A-Za-z0-9_]{24,}/gi,

  // GitHub Token
  /ghp_[A-Za-z0-9_]{36}/g,
  /github_pat_[A-Za-z0-9_]{82}/g,

  // Private 키 패턴
  /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/,
];

// 환경 변수 값 패턴 (이름이 아닌 실제 값)
const ENV_VALUE_PATTERNS = [
  // Notion 토큰 패턴
  /secret_[A-Za-z0-9_]{40,50}/g,

  // UUID 패턴 (DATABASE_ID 등)
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
];

// 제외할 디렉토리
const EXCLUDE_DIRS = ['node_modules', '.git', '.astro', 'scripts', 'src'];

// 허용된 컨텍스트 (코드 예제 등)
const ALLOWED_CONTEXTS = [
  '<code>',
  '<pre>',
  'class="language-',
  'NOTION_DATABASE_ID',
  'NOTION_TOKEN',
  'env.',
  'process.env',
  'import.meta.env',
];

/**
 * 파일이 검사 대상인지 확인
 */
function shouldCheckFile(filePath) {
  const ext = path.extname(filePath);
  return ['.js', '.html', '.json', '.css'].includes(ext);
}

/**
 * 텍스트가 안전한 컨텍스트에 있는지 확인
 */
function isInSafeContext(content, index) {
  // 앞뒤 100자를 확인하여 코드 블록이나 설명 문서인지 판단
  const contextStart = Math.max(0, index - 100);
  const contextEnd = Math.min(content.length, index + 100);
  const context = content.substring(contextStart, contextEnd);

  return ALLOWED_CONTEXTS.some((allowed) => context.includes(allowed));
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
          matches: [...new Set(matches)],
        });
      }
    }

    // 환경 변수 값 패턴 검사
    for (const pattern of ENV_VALUE_PATTERNS) {
      let match;
      const regex = new RegExp(pattern);

      while ((match = regex.exec(content)) !== null) {
        // 안전한 컨텍스트인지 확인
        if (!isInSafeContext(content, match.index)) {
          issues.push({
            file: relativePath,
            type: 'env_value_exposed',
            value: match[0],
            context: content.substring(match.index - 50, match.index + 50),
          });
        }
      }
    }

    // 실제 환경 변수 값이 하드코딩되어 있는지 검사
    const actualEnvValues = {
      NOTION_TOKEN: process.env.NOTION_TOKEN,
      NOTION_DATABASE_ID: process.env.NOTION_DATABASE_ID,
    };

    for (const [name, value] of Object.entries(actualEnvValues)) {
      if (value && content.includes(value)) {
        issues.push({
          file: relativePath,
          type: 'actual_env_value_exposed',
          envVar: name,
          severity: 'critical',
        });
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
  } catch (error) {
    console.log('ℹ️  No dist directory found. Skipping security check.', error);
    process.exit(0);
  }

  // 보안 검사 실행
  const issues = await checkDirectory(distDir);

  // 심각도별로 이슈 분류
  const criticalIssues = issues.filter((i) => i.severity === 'critical');
  const warningIssues = issues.filter((i) => i.severity !== 'critical');

  if (criticalIssues.length > 0) {
    console.error('🚨 CRITICAL SECURITY ISSUES FOUND!\n');
    criticalIssues.forEach((issue) => {
      console.error(`❌ ${issue.envVar} value exposed in ${issue.file}`);
    });
    console.error('\nDO NOT DEPLOY! Environment variable values are exposed!\n');
    process.exit(1);
  }

  if (warningIssues.length === 0) {
    console.log('✅ Security check passed! No sensitive information found in build output.\n');
    process.exit(0);
  } else {
    console.log('⚠️  Security warnings found:\n');

    warningIssues.forEach((issue) => {
      console.warn(`- ${issue.file}`);
      if (issue.value) {
        console.warn(`  Found: ${issue.value.substring(0, 10)}...`);
      }
    });

    console.log('\nPlease review these warnings before deploying.\n');
    process.exit(0);
  }
}

// 스크립트 실행
main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
