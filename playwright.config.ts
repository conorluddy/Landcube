import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  globalSetup: './tests/browser/prepare-browser-fixture.ts',
  // Lets CI shards split by test instead of by file; one worker still runs tests serially.
  fullyParallel: true,
  workers: 1,
  timeout: 30_000,
  use: {
    // GitHub's Ubuntu runners ship Chrome, so CI skips downloading a browser.
    channel: 'chrome',
    headless: true,
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
  },
});
