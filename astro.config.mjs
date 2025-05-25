import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  // GitHub Pages 배포를 위한 설정
  site: 'https://hyun-Bell.github.io', // 메인 도메인
  base: '/', // 루트 경로 사용

  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
  ],

  trailingSlash: 'ignore',

  build: {
    format: 'directory',
  },

  output: 'static',
});
