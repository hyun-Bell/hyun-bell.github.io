import { marked } from 'marked';
import Prism from 'prismjs';
import { sanitizeContent } from './sanitizer';

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
 * 제목 정보 타입
 */
export interface Heading {
  depth: number;
  text: string;
  slug: string;
}

/**
 * 파싱 결과 타입
 */
export interface ParseResult {
  html: string;
  headings: Heading[];
}

/**
 * 텍스트를 slug로 변환
 */
function createSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s가-힣-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Notion 마크다운을 HTML로 변환하고 제목 추출
 */
export function parseNotionMarkdown(markdown: string): ParseResult {
  const sanitizedMarkdown = sanitizeContent(markdown);
  const headings: Heading[] = [];

  // marked 렌더러 커스터마이징
  const renderer = new marked.Renderer();

  // 제목 렌더링 및 추출
  renderer.heading = (text: string, level: number): string => {
    const slug = createSlug(text);

    // 제목 정보 저장
    headings.push({
      depth: level,
      text,
      slug,
    });

    // id 속성 추가
    return `<h${level} id="${slug}">${text}</h${level}>`;
  };

  // 코드 블록 렌더링 (기존과 동일)
  renderer.code = (code: string, language?: string): string => {
    const lang = language ? languageAliases[language] || language : 'plaintext';

    try {
      const highlighted = Prism.languages[lang]
        ? Prism.highlight(code, Prism.languages[lang], lang)
        : code;

      return `<pre class="language-${lang}"><code class="language-${lang}">${highlighted}</code></pre>`;
    } catch (e) {
      console.warn(`Failed to highlight ${lang}:`, e);
      return `<pre class="language-${lang}"><code class="language-${lang}">${escapeHtml(code)}</code></pre>`;
    }
  };

  renderer.codespan = (code: string): string => {
    return `<code class="inline-code">${escapeHtml(code)}</code>`;
  };

  renderer.link = (href: string, _title: string | null, text: string): string => {
    const isExternal = href.startsWith('http');
    const attrs = isExternal ? 'target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${href}" ${attrs}>${text}</a>`;
  };

  marked.setOptions({
    renderer,
    gfm: true,
    breaks: true,
  });

  const html = marked.parse(sanitizedMarkdown) as string;

  return { html, headings };
}

/**
 * 마크다운에서 제목만 추출 (HTML 변환 없이)
 */
export function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  let match;

  while ((match = headingRegex.exec(markdown)) !== null) {
    if (match[1] && match[2]) {
      const depth = match[1].length;
      const text = match[2].trim();
      const slug = createSlug(text);

      headings.push({ depth, text, slug });
    }
  }

  return headings;
}

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

const languageAliases: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  sh: 'bash',
  shell: 'bash',
  yml: 'yaml',
  md: 'markdown',
};
