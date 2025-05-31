export function sanitizeContent(content: string): string {
  // 정말 민감한 패턴만 제거
  return content
    .replace(/secret_[A-Za-z0-9_]{40,}/g, 'secret_***') // 실제 시크릿 토큰
    .replace(/ghp_[A-Za-z0-9_]{36}/g, 'ghp_***') // GitHub 토큰
    .replace(/-----BEGIN.*?PRIVATE KEY-----/g, '[PRIVATE KEY REMOVED]'); // 개인키
}
