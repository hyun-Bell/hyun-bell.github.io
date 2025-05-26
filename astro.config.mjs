import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  site: 'https://hyun-bell.github.io',
  base: '/',

  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
  ],

  trailingSlash: 'ignore',

  build: {
    format: 'directory',
    inlineStylesheets: 'auto',
  },

  output: 'static',
});
