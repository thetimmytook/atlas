import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/browser/**', 'tests/e2e/**', 'tests/platform/**'],
    environment: 'node',
  },
});
