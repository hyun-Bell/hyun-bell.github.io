import { marked } from 'marked';
import Prism from 'prismjs';
import { sanitizeContent } from './sanitizer';

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
  const sanitizedMarkdown = sanitizeContent(markdown);
  const headings: Heading[] = [];

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

    return `
<figure class="blog-figure">
  <img 
    src="${href}" 
    alt="${escapeHtml(altText)}"
    loading="lazy"
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

  let html = marked.parse(sanitizedMarkdown) as string;
  html = html.replace(/(<\/figure>)\s*<p>\s*<\/p>/g, '$1');

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

const languageAliases: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  sh: 'bash',
  shell: 'bash',
  yml: 'yaml',
  md: 'markdown',
};
