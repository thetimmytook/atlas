import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    attachmentsDir: 'node_modules/.cache/vitest-attachments',
    include: ['tests/browser/**/*.browser.test.ts'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({ actionTimeout: 2_000 }),
      instances: [{ browser: 'chromium' }],
      viewport: { width: 900, height: 700 },
      screenshotDirectory: 'node_modules/.cache/browser-tests',
    },
  },
});
