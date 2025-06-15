import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import remarkGfm from 'remark-gfm';

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
    format: 'directory',
    inlineStylesheets: 'auto',
    assets: '_astro',
  },

  trailingSlash: 'ignore',

  markdown: {
    remarkPlugins: [remarkGfm],
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      defaultColor: false,
      wrap: true,
      langs: ['javascript', 'typescript', 'json', 'html', 'css', 'bash', 'python', 'astro'],
    },
  },

  vite: {
    cacheDir: '.astro/vite',
    optimizeDeps: {
      include: ['@notionhq/client', 'notion-to-md'],
    },
    build: {
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
