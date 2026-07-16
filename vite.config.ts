/// <reference types="nitro/vite/types" />
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import stylex from '@stylexjs/unplugin';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import { defineConfig, lazyPlugins } from 'vite-plus';

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  staged: {
    '*': 'vp check --fix',
  },
  optimizeDeps: {
    exclude: ['fsevents'],
  },
  fmt: {
    printWidth: 100,
    tabWidth: 2,
    semi: true,
    singleQuote: true,
    trailingComma: 'all',
    sortImports: true,
    ignorePatterns: ['.output', 'node_modules', 'src/routeTree.gen.ts'],
  },
  lint: {
    categories: {
      correctness: 'error',
      suspicious: 'warn',
      perf: 'warn',
    },
    plugins: ['react', 'typescript', 'unicorn', 'import', 'jsx-a11y', 'oxc'],
    env: {
      browser: true,
      node: true,
      es2022: true,
    },
    rules: {
      'no-console': [
        'warn',
        {
          allow: ['warn', 'error'],
        },
      ],
      'eslint/no-unused-vars': 'error',
      'typescript/no-explicit-any': 'warn',
      'react/react-in-jsx-scope': 'off',
      'import/no-named-as-default-member': 'off',
      'import/no-unassigned-import': 'off',
      'vite-plus/prefer-vite-plus-imports': 'error',
    },
    settings: {
      react: {
        linkComponents: ['Link'],
      },
    },
    ignorePatterns: ['.output', 'node_modules', 'src/routeTree.gen.ts', '.cache', 'scripts/'],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    jsPlugins: [
      {
        name: 'vite-plus',
        specifier: 'vite-plus/oxlint-plugin',
      },
    ],
  },
  server: {
    port: 3000,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: lazyPlugins(() => [
    tanstackStart(),
    nitro({
      experimental: {
        database: true,
        tasks: true,
      },
      database: {
        default: {
          connector: 'postgresql',
          options: { url: process.env.DATABASE_URL },
        },
      },
      rollupConfig: {
        external: ['playwright', 'playwright-core', 'jsdom'],
      },
      tasks: {
        'db:create-extensions': {
          handler: resolve(rootDir, 'src/runtime/tasks/db-extensions.ts'),
          description: 'Enable ParadeDB pg_search extension',
        },
        'db:seed': {
          handler: resolve(rootDir, 'src/runtime/tasks/db-seed.ts'),
          description: 'Insert seed URLs from SEED_URLS env var (comma-separated) into pages table',
        },
      },
    }),
    stylex.vite({
      dev: process.env.NODE_ENV === 'development',
      useCSSLayers: true,
      runtimeInjection: false,
    }),
    viteReact(),
  ]),
});
