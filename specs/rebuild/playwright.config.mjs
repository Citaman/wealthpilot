import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'workspace.browser.mjs',
  workers: 1,
  timeout: 60000,
  reporter: 'list',
  outputDir: '../../tmp/rebuild-qa',
  use: {
    headless: true,
    locale: 'fr-FR',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});