import { expect, test, type Page } from '@playwright/test';
import { appUrl, serveStudio } from './studio-fixture';

const themeStorageKey = 'landcube-theme';

test.beforeEach(async ({ page }) => {
  await serveStudio(page);
});

function readThemeState(page: Page) {
  return page.evaluate(() => ({
    dataTheme: document.documentElement.dataset.theme ?? null,
    metaColour: document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null,
    colorScheme: getComputedStyle(document.documentElement).colorScheme,
    inspectorBackground: getComputedStyle(
      document.querySelector('[aria-label="Landscape controls"]') ?? document.body,
    ).backgroundColor,
    storedTheme: localStorage.getItem('landcube-theme'),
  }));
}

test('the footer toggle switches to light, persists across reload and restores dark', async ({
  page,
}) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  const dark = await readThemeState(page);

  expect(dark).toMatchObject({ dataTheme: null, colorScheme: 'dark', storedTheme: null });

  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  const light = await readThemeState(page);

  expect(light).toMatchObject({
    dataTheme: 'light',
    colorScheme: 'light',
    storedTheme: 'light',
    metaColour: '#f6f6f4',
  });
  expect(light.metaColour).not.toBe(dark.metaColour);
  expect(light.inspectorBackground).not.toBe(dark.inspectorBackground);
  await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await page.reload();
  expect(await readThemeState(page)).toMatchObject({ dataTheme: 'light', metaColour: '#f6f6f4' });

  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  expect(await readThemeState(page)).toEqual(dark);
  expect(await page.evaluate((key) => localStorage.getItem(key), themeStorageKey)).toBeNull();
});
