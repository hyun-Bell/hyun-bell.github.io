import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import remarkGfm from 'remark-gfm';
import rehypePrismPlus from 'rehype-prism-plus';

// https://astro.build/config
export default defineConfig({
  site: 'https://hyun-bell.github.io',
  base: '/',

  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    sitemap(),
  ],

  output: 'static',

  build: {
    // 빌드 출력 형식
    format: 'directory',

    // 인라인 스타일 최적화
    inlineStylesheets: 'auto',

    // 에셋 디렉토리
    assets: '_astro',
  },

  // 트레일링 슬래시 처리
  trailingSlash: 'ignore',

  // Markdown 설정
  markdown: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [
      [
        rehypePrismPlus,
        {
          ignoreMissing: true,
          defaultLanguage: 'plaintext',
        },
      ],
    ],
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },

  // Vite 설정
  vite: {
    // 빌드 캐시 디렉토리
    cacheDir: '.astro/vite',

    // 최적화
    optimizeDeps: {
      include: ['@notionhq/client', 'notion-to-md'],
    },

    build: {
      // 청크 분할 전략
      rollupOptions: {
        output: {
          manualChunks: {
            notion: ['@notionhq/client', 'notion-to-md'],
          },
        },
      },
    },
  },
});
