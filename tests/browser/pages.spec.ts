import { expect, test } from '@playwright/test';
import { appUrl, download, section, serveStudio } from './studio-fixture';

test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } });

test('GitHub Pages repository subpath loads the studio, lazy 3D, style links and exports', async ({
  page,
}) => {
  await serveStudio(page, 'Topogra/');
  const errors: string[] = [];
  const assets: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.url().includes('/assets/')) {
      assets.push(response.url());
      expect(response.ok()).toBe(true);
    }
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (url: string) => {
          document.documentElement.dataset.copiedLink = url;

          return Promise.resolve();
        },
      },
    });
  });
  await page.goto(`${appUrl}Topogra/?v=1&seed=123&width=320&height=240`);
  await expect(page.getByRole('heading', { name: 'Topogra Landscape studio' })).toBeVisible();
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(page.locator('canvas.terrain-3d')).toBeVisible();
  await section(page, 'Model');
  await expect(page.getByLabel('Width (X, mm)', { exact: true })).toHaveValue('150');
  await page.getByRole('button', { name: 'Copy style link', exact: true }).click();
  const copied = await page.locator('html').getAttribute('data-copied-link');

  expect(copied).not.toBeNull();

  if (copied === null) {
    throw new Error('Style link unavailable');
  }

  expect(new URL(copied).pathname).toBe('/Topogra/');
  await page.getByRole('button', { name: 'Export ↗' }).click();
  await expect(page.getByAltText('Settled landscape export preview')).toBeVisible();
  const svg = await download(page, 'Download SVG');

  expect(svg.bytes.toString()).toContain('viewBox="0 0 320 240"');
  expect((await download(page, 'Download STL')).bytes.readUInt32LE(80)).toBeGreaterThan(0);
  expect(assets.length).toBeGreaterThanOrEqual(3);
  expect(assets.every((url) => new URL(url).pathname.startsWith('/Topogra/assets/'))).toBe(true);
  expect(assets.some((url) => url.includes('/terrain-3d-'))).toBe(true);
  expect(errors).toEqual([]);
});
