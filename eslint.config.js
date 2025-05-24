import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import astro from 'eslint-plugin-astro';
import astroParser from 'astro-eslint-parser';

export default [
  // 기본 설정
  js.configs.recommended,

  // 전역 ignores
  {
    ignores: [
      'dist/**',
      '.astro/**',
      'node_modules/**',
      '*.d.ts',
      'coverage/**',
      // Config files
      'postcss.config.cjs',
      'tailwind.config.mjs',
      'astro.config.mjs',
      '*.config.js',
      '*.config.mjs',
      '*.config.cjs',
    ],
  },

  // 모든 파일에 대한 공통 설정
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
  },

  // TypeScript 파일 설정 (type-aware rules 제외)
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      // 기본 TypeScript 규칙
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      // JavaScript 규칙
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-unused-vars': 'off', // TypeScript 규칙으로 대체
    },
  },

  // Astro 파일 설정
  {
    files: ['**/*.astro'],
    languageOptions: {
      parser: astroParser,
      parserOptions: {
        parser: typescriptParser,
        extraFileExtensions: ['.astro'],
      },
    },
    plugins: {
      astro,
    },
    rules: {
      ...astro.configs.recommended.rules,
    },
  },
];
