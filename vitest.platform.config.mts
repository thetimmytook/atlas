import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/platform/**/*.platform.test.ts'],
    environment: 'node',
    fileParallelism: false,
    maxWorkers: 1,

    // Each engine owns a sequential group of isolated contexts, not one input action.
    testTimeout: 120_000,
    hookTimeout: 30_000,
  },
});
