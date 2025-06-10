import { marked } from 'marked';
import Prism from 'prismjs';

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

export interface Heading {
  depth: number;
  text: string;
  slug: string;
}

export interface ParseResult {
  html: string;
  headings: Heading[];
}

function createSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s가-힣-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function parseNotionMarkdown(markdown: string): ParseResult {
  const headings: Heading[] = [];
  let isFirstImage = true;

  // HTML 엔티티 디코딩으로 이중 인코딩 방지
  const decodedMarkdown = decodeHtmlEntities(markdown);
  
  // Meta 스타일 디버깅: 실제 변환 확인 (빌드/개발 모드 모두)
  const hasEntities = markdown.includes('&#39;') || markdown.includes('&#039;');
  const decodingWorked = !decodedMarkdown.includes('&#39;') && !decodedMarkdown.includes('&#039;');
  
  if (hasEntities) {
    console.warn('🔍 HTML Entity Processing:', {
      mode: import.meta.env.DEV ? 'DEV' : 'BUILD',
      originalLength: markdown.length,
      decodedLength: decodedMarkdown.length,
      hadEntities: hasEntities,
      decodingWorked: decodingWorked,
      sample: {
        before: markdown.substring(0, 60),
        after: decodedMarkdown.substring(0, 60)
      }
    });
  }

  const renderer = new marked.Renderer();

  renderer.heading = (text: string, level: number): string => {
    const slug = createSlug(text);
    headings.push({
      depth: level,
      text,
      slug,
    });
    return `<h${level} id="${slug}">${text}</h${level}>`;
  };

  // 이미지를 figure/figcaption 구조로 렌더링
  renderer.image = (href: string, title: string | null, text: string): string => {
    const altText = text || title || '';
    const caption = title || text || '';

    // 첫 번째 이미지만 eager loading
    const loadingAttr = isFirstImage ? 'eager' : 'lazy';
    const priorityAttr = isFirstImage ? 'fetchpriority="high"' : '';

    if (isFirstImage) {
      isFirstImage = false;
    }

    return `
<figure class="blog-figure">
  <img 
    src="${href}" 
    alt="${escapeHtml(altText)}"
    loading="${loadingAttr}"
    ${priorityAttr}
    decoding="async"
  />
  ${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''}
</figure>`;
  };

  // 이미지만 있는 단락은 p 태그로 감싸지 않음
  renderer.paragraph = (text: string): string => {
    const imageOnlyPattern = /^<figure class="blog-figure">[\s\S]*<\/figure>$/;

    if (imageOnlyPattern.test(text.trim())) {
      return text;
    }

    return `<p>${text}</p>`;
  };

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

  renderer.list = (body: string, ordered: boolean, start: number): string => {
    const type = ordered ? 'ol' : 'ul';
    const startAttr = ordered && start !== 1 ? ` start="${start}"` : '';
    return `<${type}${startAttr} class="blog-list">${body}</${type}>`;
  };

  renderer.table = (header: string, body: string): string => {
    return `
      <div class="table-wrapper">
        <table class="blog-table">
          <thead>${header}</thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
  };

  marked.setOptions({
    renderer,
    gfm: true,
    breaks: true,
  });

  let html = marked.parse(decodedMarkdown) as string;
  html = html.replace(/(<\/figure>)\s*<p>\s*<\/p>/g, '$1');

  // Meta 스타일 최종 안전 장치: 혹시 놓친 HTML 엔티티 처리
  html = html.replace(/&#39;/g, "'").replace(/&#039;/g, "'");
  
  // 최종 검증
  if (html.includes('&#39;') || html.includes('&#039;')) {
    console.warn('⚠️ HTML entities still present in final output');
  }

  return { html, headings };
}

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

/**
 * HTML 엔티티를 디코딩하여 이중 인코딩 방지
 * Meta의 HTML 처리 패턴을 따름 - 네이티브 브라우저 API 활용
 */
function decodeHtmlEntities(text: string): string {
  // Meta 스타일: 서버 환경에서 안전한 HTML 엔티티 디코딩
  const entityMap: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",      // 실제 Notion에서 사용하는 형태
    '&#039;': "'",     // 0이 포함된 형태도 지원
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#x60;': '`',
    '&#x3D;': '=',
  };
  
  // 1차: 맵 기반 디코딩
  let decoded = text.replace(/&[#a-zA-Z0-9]+;/g, (entity) => entityMap[entity] || entity);
  
  // 2차: 숫자 기반 HTML 엔티티 디코딩 (더 포괄적)
  decoded = decoded.replace(/&#(\d+);/g, (match, num) => {
    const code = parseInt(num, 10);
    if (code > 0 && code < 1114112) { // 유효한 유니코드 범위
      return String.fromCharCode(code);
    }
    return match;
  });
  
  // 3차: 16진수 기반 HTML 엔티티 디코딩
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
    const code = parseInt(hex, 16);
    if (code > 0 && code < 1114112) { // 유효한 유니코드 범위
      return String.fromCharCode(code);
    }
    return match;
  });
  
  return decoded;
}

const languageAliases: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  sh: 'bash',
  shell: 'bash',
  yml: 'yaml',
  md: 'markdown',
};
