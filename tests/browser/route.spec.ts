import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { appUrl, enter3D, loadLocation, modelDownload, serveStudio } from './studio-fixture';

test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } });
// Software WebGL on CI runners is several times slower than local GPUs.
test.describe.configure({ timeout: 90_000 });
test.beforeEach(async ({ page }) => {
  await serveStudio(page);
});

const routeFile = resolve('tests/fixtures/route.gpx');
const malformedFile = resolve('tests/fixtures/malformed.gpx');

test('a GPX route draws in 2D with waypoints, hides on toggle and clears', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await loadLocation(page);
  await page.getByRole('button', { name: 'Overlays', exact: true }).click();
  await page.getByLabel('GPX file').setInputFiles(routeFile);

  const route = page.locator('.lc-route-line');

  await expect(route).toBeVisible();
  await expect(route).toHaveAttribute('data-route-waypoints', '2');
  await expect(route.locator('.lc-route-line__label')).toHaveText(['Start hut', 'Summit']);
  await expect(
    page.getByText(/Ridge walk · \d+\.\d km · ascent \d+ m · descent \d+ m · 2 waypoints/),
  ).toBeVisible();
  await expect(page.getByText(/\d+ of \d+ points inside the loaded area\./)).toBeVisible();

  await page.getByRole('switch', { name: 'Show route', exact: true }).uncheck();
  await expect(route).toHaveCount(0);
  await page.getByRole('switch', { name: 'Show route', exact: true }).check();
  await expect(route).toBeVisible();

  await page.getByRole('button', { name: 'Clear route', exact: true }).click();
  await expect(route).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Clear route', exact: true })).toBeDisabled();
});

test('a GPX route drapes in 3D and never changes the printable STL', async ({ page }) => {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${appUrl}?v=1&seed=123`);
  await loadLocation(page);
  await enter3D(page);
  const canvas = page.locator('canvas.terrain-3d');

  await expect(canvas).toBeVisible();
  await expect(canvas).not.toHaveAttribute('data-route-points', /.*/);
  const before = await modelDownload(page);

  await page.getByRole('button', { name: 'Overlays', exact: true }).click();
  await page.getByLabel('GPX file').setInputFiles(routeFile);
  await expect(canvas).toHaveAttribute('data-route-points', /^[1-9]\d*$/);
  await expect(canvas).toHaveAttribute('data-route-waypoints', '2');

  // Roads are off, so the ribbon on screen is the route's own.
  await page.getByRole('switch', { name: 'Show route', exact: true }).uncheck();
  await expect(canvas).not.toHaveAttribute('data-route-points', /.*/);
  await page.getByRole('switch', { name: 'Show route', exact: true }).check();
  await expect(canvas).toHaveAttribute('data-route-points', /^[1-9]\d*$/);

  await page.keyboard.press('Escape');
  expect((await modelDownload(page)).equals(before)).toBe(true);
  expect(errors).toEqual([]);
});

test('an invalid GPX file shows an E-206 fault and keeps the previous route', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await loadLocation(page);
  await page.getByRole('button', { name: 'Overlays', exact: true }).click();
  await page.getByLabel('GPX file').setInputFiles(routeFile);
  await expect(page.locator('.lc-route-line')).toBeVisible();

  await page.getByLabel('GPX file').setInputFiles(malformedFile);
  const fault = page.getByRole('alert').filter({ hasText: 'E-206' });

  await expect(fault).toBeVisible();
  await expect(fault).toContainText('not well-formed');
  await expect(page.locator('.lc-route-line')).toBeVisible();

  await page.getByLabel('GPX file').setInputFiles(routeFile);
  await expect(fault).toHaveCount(0);
});

test('the route group needs a real location', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await page.getByRole('button', { name: 'Overlays', exact: true }).click();
  await expect(page.getByLabel('GPX file')).toHaveCount(0);
});
