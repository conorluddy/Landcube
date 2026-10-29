import { expect, test, type Page } from '@playwright/test';
import { serveSpecimens, specimensUrl } from './specimens-fixture';

interface MediaMode {
  suffix: string;
  media: Parameters<Page['emulateMedia']>[0];
}

const mediaModes: MediaMode[] = [
  { suffix: '', media: {} },
  { suffix: '-reduced-motion', media: { reducedMotion: 'reduce' } },
  { suffix: '-forced-colors', media: { forcedColors: 'active' } },
];

// Screenshot baselines are generated on macOS and checked by the pre-commit hook; CI renders differently, so it skips them.
test.skip(() => Boolean(process.env.CI), 'Screenshot baselines are local-only (macOS).');
// Each media mode screenshots every specimen in one test, so the budget grows with the catalogue.
test.describe.configure({ timeout: 120_000 });
test.beforeEach(async ({ page }) => {
  await serveSpecimens(page);
});

test('specimens page loads Geist and Geist Mono', async ({ page }) => {
  await page.goto(`${specimensUrl}specimens.html`);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('10px "Geist Mono"'))).toBe(true);
  expect(await page.evaluate(() => document.fonts.check('10px "Geist"'))).toBe(true);
});

// One test per media mode: new components add specimens, not test code.
for (const { suffix, media } of mediaModes) {
  test(`every specimen matches its screenshot${suffix || ' (default media)'}`, async ({ page }) => {
    await page.emulateMedia(media);
    await page.goto(`${specimensUrl}specimens.html`);
    await page.evaluate(() => document.fonts.ready);

    const articles = page.locator('[data-specimen]');
    const count = await articles.count();

    expect(count).toBeGreaterThan(0);

    for (let index = 0; index < count; index++) {
      const article = articles.nth(index);
      const key = (await article.getAttribute('data-specimen')) ?? `unknown-${String(index)}`;

      await expect(article).toHaveScreenshot(`${key.replaceAll('/', '--')}${suffix}.png`, {
        animations: 'disabled',
        maxDiffPixels: 0,
      });
    }
  });
}
