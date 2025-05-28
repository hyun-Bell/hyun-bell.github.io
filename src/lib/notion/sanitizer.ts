/**
 * Notion 콘텐츠 보안 처리
 */

// 대체 텍스트
const REPLACEMENTS: Record<string, string> = {
  NOTION_TOKEN: 'NOTION_***',
  NOTION_DATABASE_ID: 'NOTION_DB_***',
  NOTION_PAGES_DATABASE_ID: 'NOTION_PAGES_***',
  NOTION_PROJECTS_DATABASE_ID: 'NOTION_PROJECTS_***',
  NOTION_SNIPPETS_DATABASE_ID: 'NOTION_SNIPPETS_***',
};

/**
 * 콘텐츠에서 민감한 정보 제거
 */
export function sanitizeContent(content: string): string {
  let sanitized = content;

  // 코드 블록 보호
  const codeBlocks: string[] = [];
  const codeBlockRegex = /```[\s\S]*?```/g;

  // 코드 블록 임시 저장
  sanitized = sanitized.replace(codeBlockRegex, (match) => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });

  // 일반 텍스트에서 민감한 정보 제거
  for (const [key, replacement] of Object.entries(REPLACEMENTS)) {
    const regex = new RegExp(key, 'g');
    sanitized = sanitized.replace(regex, replacement);
  }

  // UUID 패턴 제거 (코드 블록 외부)
  sanitized = sanitized.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    'xxxx-xxxx-xxxx-xxxx',
  );

  // secret_ 패턴 제거
  sanitized = sanitized.replace(/secret_[A-Za-z0-9_]{40,}/g, 'secret_***');

  // 코드 블록 복원 (코드 블록 내부는 보존)
  codeBlocks.forEach((block, index) => {
    sanitized = sanitized.replace(`__CODE_BLOCK_${index}__`, block);
  });

  return sanitized;
}

/**
 * 메타데이터에서 민감한 정보 제거
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sanitizeMetadata(data: any): any {
  const sanitized = JSON.parse(JSON.stringify(data));

  // ID 필드 마스킹
  if (sanitized.id && typeof sanitized.id === 'string') {
    // Notion 페이지 ID는 유지하되, 다른 UUID는 마스킹
    if (!sanitized.id.includes('-')) {
      // Notion ID (하이픈 제거된 형태)는 유지
    } else {
      sanitized.id = sanitized.id.substring(0, 8) + '...';
    }
  }

  // 기타 민감한 필드 확인
  const sensitiveFields = ['token', 'secret', 'key', 'password'];

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '***';
    }
  }

  return sanitized;
}
