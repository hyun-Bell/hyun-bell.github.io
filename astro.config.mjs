import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import remarkGfm from 'remark-gfm';

// https://astro.build/config
export default defineConfig({
  site: 'https://hyun-bell.github.io',
  base: '/',
  prefetch: true,
  integrations: [sitemap()],

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
      cssVariablePrefix: '--shiki-',
      wrap: true,
      langs: ['javascript', 'typescript', 'json', 'html', 'css', 'bash', 'python', 'astro'],
    },
  },

  vite: {
    plugins: [tailwindcss()],
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
