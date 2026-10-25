import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';

const appUrl = 'https://topogra.test/';

test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } });

test.beforeEach(async ({ page }) => {
  // Serve the production chunks through routes so lazy WebGL imports work without a server.
  await page.route(`${appUrl}**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const filename = pathname === '/' ? 'index.html' : pathname.slice(1);
    const contentType = filename.endsWith('.js')
      ? 'text/javascript'
      : filename.endsWith('.css')
        ? 'text/css'
        : 'text/html';

    await route.fulfill({ body: await readFile(resolve('dist', filename)), contentType });
  });
});

test('3D controls retain surface, contour and lighting choices across tab and view changes', async ({
  page,
}) => {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${appUrl}?v=1&seed=123`);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(page.locator('canvas.terrain-3d')).toHaveCount(0);
  await page.getByRole('switch', { name: 'Show raised contours' }).check();
  await expect(page.locator('canvas.terrain-3d')).toBeVisible();
  const height = page.getByRole('slider', { name: 'Height exaggeration' });

  await expect(height).toHaveValue('0.3');
  await expect(height).toHaveAttribute('max', '1');
  await expect(page.getByLabel('Surface color')).toHaveValue('#202326');
  await expect(page.getByLabel('Surface color')).toBeDisabled();
  await page.getByRole('switch', { name: 'Contour lines', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  const clip = { x: 100, y: 150, width: 650, height: 450 };
  const baseline = PNG.sync.read(await page.screenshot({ clip })).data;

  await page.getByRole('button', { name: 'Expand controls' }).click();
  await page.locator('#terrain-light-direction').fill('135');
  await page.locator('#terrain-light-elevation').fill('15');
  await page.locator('#terrain-light-fill').fill('0.3');
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  const relit = PNG.sync.read(await page.screenshot({ clip })).data;

  expect(relit.equals(baseline)).toBe(false);
  await page.getByRole('button', { name: 'Expand controls' }).click();
  await page.getByRole('button', { name: 'Reset lighting', exact: true }).click();
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  const reset = PNG.sync.read(await page.screenshot({ clip })).data;

  expect(reset.equals(baseline)).toBe(true);
  await page.getByRole('button', { name: 'Expand controls' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Canvas', { exact: true }).fill('#334455');
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(page.getByLabel('Surface color')).toHaveValue('#334455');
  await page.getByRole('switch', { name: 'Match background' }).uncheck();
  await page.getByLabel('Surface color').fill('#667788');
  await height.fill('0.5');
  await page.getByRole('switch', { name: 'Show raised contours' }).uncheck();
  await expect(page.locator('#terrain')).toBeVisible();
  await page.getByRole('switch', { name: 'Show raised contours' }).check();
  await expect(height).toHaveValue('0.5');
  await expect(page.getByLabel('Surface color')).toHaveValue('#667788');
  await expect(page.getByRole('switch', { name: 'Contour lines', exact: true })).not.toBeChecked();
  await page.getByRole('switch', { name: 'Matte surface' }).uncheck();
  await expect(page.getByLabel('Surface color')).toBeHidden();
  expect(errors).toEqual([]);
});

test('failed WebGL loading leaves the 2D design and controls available', async ({ page }) => {
  await page.route(/terrain-3d-[^/]+\.js$/, (route) => route.abort());
  await page.goto(appUrl);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.getByRole('switch', { name: 'Show raised contours' }).check();
  await expect(page.locator('#panel-status')).toContainText('3D preview could not start');
  await expect(page.getByRole('switch', { name: 'Show raised contours' })).not.toBeChecked();
  await expect(page.locator('#terrain')).toBeVisible();
  await expect(page.locator('[data-options]')).toBeHidden();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Canvas', { exact: true })).toBeVisible();
});
