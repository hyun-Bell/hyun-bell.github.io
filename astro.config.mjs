import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
  ],
  // 트레일링 슬래시 설정 명시
  trailingSlash: 'ignore',
  // 빌드 설정
  build: {
    format: 'directory',
  },
  output: 'static',
});
