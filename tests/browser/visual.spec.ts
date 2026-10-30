import { expect, test, type Page } from '@playwright/test';
import { appUrl, openDefaultStudio, serveStudio } from './studio-fixture';

// Pixel baselines guard the design-system port: restyling must not move a pixel until a change is intended.
// Screenshot baselines are generated on macOS and checked by the pre-commit hook; CI renders differently, so it skips them.
test.skip(() => Boolean(process.env.CI), 'Screenshot baselines are local-only (macOS).');
test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } });
test.beforeEach(async ({ page }) => {
  await serveStudio(page);
});

async function expectSettledScreenshot(page: Page, name: string): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot(name, {
    maxDiffPixels: 0,
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
  });
}

test('visual baseline: 2D procedural desktop', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await expect(page.locator('#terrain')).toBeVisible();
  await expectSettledScreenshot(page, '2d-procedural.png');
});

test('visual baseline: 3D default desktop', async ({ page }) => {
  await openDefaultStudio(page);
  await expect(page.locator('canvas.terrain-3d')).toBeVisible();
  await expectSettledScreenshot(page, '3d-default.png');
});

test('visual baseline: mobile 390', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${appUrl}?v=1&seed=123`);
  await expect(page.locator('#terrain')).toBeVisible();
  await expectSettledScreenshot(page, 'mobile-390.png');
});
