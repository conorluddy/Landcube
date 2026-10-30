import { defineConfig } from '@playwright/test';

/**
 * Software WebGL makes these specs slow on CI, so each group gets its own runner.
 * The studio project takes every other spec, so a file lands in exactly one project.
 */
const terrainSpecs = ['terrain-3d.spec.ts'];
const toolSpecs = ['frame.spec.ts', 'tools.spec.ts', 'route.spec.ts', 'hud.spec.ts'];

export default defineConfig({
  testDir: './tests/browser',
  globalSetup: './tests/browser/prepare-browser-fixture.ts',
  // Lets CI shards split by test instead of by file; one worker still runs tests serially.
  fullyParallel: true,
  workers: 1,
  timeout: 30_000,
  // Keeps baseline names free of the project name.
  snapshotPathTemplate:
    '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-snapshotSuffix}{ext}',
  use: {
    // GitHub's Ubuntu runners ship Chrome, so CI skips downloading a browser.
    channel: 'chrome',
    headless: true,
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: '3d-terrain', testMatch: terrainSpecs },
    { name: '3d-tools', testMatch: toolSpecs },
    { name: 'studio', testIgnore: [...terrainSpecs, ...toolSpecs] },
  ],
});
