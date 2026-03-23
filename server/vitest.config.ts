import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Prevent Vite from walking up to the root postcss.config.js
  // (autoprefixer is a client-only dependency, not available in server/node_modules)
  css: {
    postcss: {},
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30000,
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/types/**', 'src/**/*.d.ts'],
    },
  },
});
