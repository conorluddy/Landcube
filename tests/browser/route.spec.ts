import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import {
  appUrl,
  enter3D,
  loadLocation,
  modelDownload,
  section,
  serveStudio,
} from './studio-fixture';

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
  await section(page, 'Route');
  await page.getByLabel('GPX file').setInputFiles(routeFile);

  const route = page.locator('.lc-route-line');

  await expect(route).toBeVisible();
  await expect(route).toHaveAttribute('data-route-waypoints', '2');
  await expect(route.locator('.lc-route-line__label')).toHaveText(['Start hut', 'Summit']);
  await expect(
    page.getByText(
      /Ridge walk · \d+\.\d km ground · .*ascent \d+ m · descent \d+ m · net [+-]?\d+ m · Terrain-derived · 2 waypoints/,
    ),
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

  await section(page, 'Route');
  await page.getByLabel('GPX file').setInputFiles(routeFile);
  await expect(canvas).toHaveAttribute('data-route-points', /^[1-9]\d*$/);
  await expect(canvas).toHaveAttribute('data-route-waypoints', '2');

  // Roads are off, so the ribbon on screen is the route's own.
  await page.getByRole('switch', { name: 'Show route', exact: true }).uncheck();
  await expect(canvas).not.toHaveAttribute('data-route-points', /.*/);
  await page.getByRole('switch', { name: 'Show route', exact: true }).check();
  await expect(canvas).toHaveAttribute('data-route-points', /^[1-9]\d*$/);

  expect((await modelDownload(page)).equals(before)).toBe(true);
  expect(errors).toEqual([]);
});

test('a route follows terraced 3D models and stays out of the STL in both shapes', async ({
  page,
}) => {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${appUrl}?v=1&seed=123`);
  await loadLocation(page);
  await enter3D(page);
  const canvas = page.locator('canvas.terrain-3d');
  const showRoute = page.getByRole('switch', { name: 'Show route', exact: true });

  await section(page, 'Route');
  await page.getByLabel('GPX file').setInputFiles(routeFile);
  await expect(canvas).toHaveAttribute('data-route-points', /^[1-9]\d*$/);

  for (const shape of ['smooth', 'terraced'] as const) {
    await section(page, 'Model');
    await page.getByLabel('Terrain shape', { exact: true }).selectOption(shape);
    await section(page, 'Route');
    await expect(canvas).toHaveAttribute('data-route-points', /^[1-9]\d*$/);
    await expect(canvas).toHaveAttribute('data-route-waypoints', '2');
    const shown = await modelDownload(page);

    await showRoute.uncheck();
    await expect(canvas).not.toHaveAttribute('data-route-points', /.*/);
    expect((await modelDownload(page)).equals(shown), `${shape} STL`).toBe(true);
    await showRoute.check();
  }

  expect(errors).toEqual([]);
});

test('a retained route rebuilds against a newly loaded location', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await loadLocation(page);
  await enter3D(page);
  const canvas = page.locator('canvas.terrain-3d');

  await section(page, 'Route');
  await page.getByLabel('GPX file').setInputFiles(routeFile);
  await expect(canvas).toHaveAttribute('data-route-points', /^[1-9]\d*$/);
  const builds = Number(await canvas.getAttribute('data-route-builds'));

  // A nudge keeps the route on the model while the (routed, synthetic) tiles change under it.
  await section(page, 'Terrain');
  const latitude = page.getByLabel('Latitude', { exact: true });

  await latitude.fill(String(Number(await latitude.inputValue()) - 0.005));
  await latitude.press('Tab');
  await page.getByRole('button', { name: 'Load terrain', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Real terrain loaded' })).toBeVisible();
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-route-builds')))
    .toBeGreaterThan(builds);
  await expect(canvas).toHaveAttribute('data-route-points', /^[1-9]\d*$/);
});

test('loading an off-centre GPX offers to centre the terrain on it', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await loadLocation(page);
  await section(page, 'Route');
  await page.getByLabel('GPX file').setInputFiles(routeFile);
  const centre = page.getByRole('button', { name: 'Centre terrain on route', exact: true });

  await centre.click();
  // The offer goes once the new terrain frames the route.
  await expect(centre).toHaveCount(0);
  await expect(page.getByText(/^(\d+) of \1 points inside the loaded area\.$/)).toBeVisible();
  await section(page, 'Terrain');
  await expect(page.getByLabel('Latitude', { exact: true })).toHaveValue('55.021');
  await expect(page.getByLabel('Longitude', { exact: true })).toHaveValue('-8.139');
});

test('an invalid GPX file shows an E-206 fault and keeps the previous route', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await loadLocation(page);
  await section(page, 'Route');
  await page.getByLabel('GPX file').setInputFiles(routeFile);
  await expect(page.locator('.lc-route-line')).toBeVisible();

  await page.getByLabel('GPX file').setInputFiles(malformedFile);
  const fault = page.getByRole('alert').filter({ hasText: 'E-206' });

  await expect(fault).toBeVisible();
  await expect(fault).toContainText('not well-formed');
  await expect(page.locator('.lc-route-line')).toBeVisible();

  await page.getByLabel('GPX file').setInputFiles(routeFile);
  // A valid file over an existing route asks before replacing it (REQ-19).
  await page.getByRole('button', { name: 'Replace route', exact: true }).click();
  await expect(fault).toHaveCount(0);
});

test('the Route section needs a real location', async ({ page }) => {
  const routeSection = page
    .getByRole('navigation', { name: 'Editing section' })
    .getByRole('button', { name: 'Route', exact: true });

  await page.goto(`${appUrl}?v=1&seed=123`);
  await expect(routeSection).toHaveCount(0);
  await loadLocation(page);
  await expect(routeSection).toBeVisible();
});
