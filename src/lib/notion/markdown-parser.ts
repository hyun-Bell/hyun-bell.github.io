/* src/lib/notion/markdown-parser.ts */

import { marked } from 'marked';
import Prism from 'prismjs';

// 지원할 언어들 import
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';

/**
 * 언어 별칭 매핑
 */
const languageAliases: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  sh: 'bash',
  shell: 'bash',
  yml: 'yaml',
  md: 'markdown',
};

/**
 * Notion 마크다운을 HTML로 변환
 */
export function parseNotionMarkdown(markdown: string): string {
  // marked 렌더러 커스터마이징
  const renderer = new marked.Renderer();

  // 코드 블록 렌더링
  renderer.code = (code: string, language?: string): string => {
    const lang = language ? languageAliases[language] || language : 'plaintext';

    try {
      // Prism.js로 하이라이팅
      const highlighted = Prism.languages[lang]
        ? Prism.highlight(code, Prism.languages[lang], lang)
        : code;

      return `<pre class="language-${lang}"><code class="language-${lang}">${highlighted}</code></pre>`;
    } catch (e) {
      // 하이라이팅 실패 시 원본 코드 사용
      console.warn(`Failed to highlight ${lang}:`, e);
      return `<pre class="language-${lang}"><code class="language-${lang}">${escapeHtml(code)}</code></pre>`;
    }
  };

  // 인라인 코드
  renderer.codespan = (code: string): string => {
    return `<code class="inline-code">${escapeHtml(code)}</code>`;
  };

  // 링크 (새 탭에서 열기)
  renderer.link = (href: string, _title: string | null, text: string): string => {
    const isExternal = href.startsWith('http');
    const attrs = isExternal ? 'target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${href}" ${attrs}>${text}</a>`;
  };

  // marked 설정
  marked.setOptions({
    renderer,
    gfm: true,
    breaks: true,
  });

  // 동기적으로 처리
  return marked.parse(markdown) as string;
}

/**
 * HTML 이스케이프
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m] || m);
}
