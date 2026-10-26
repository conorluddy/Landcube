import { expect, test } from '@playwright/test';
import {
  appUrl,
  download,
  loadLocation,
  modelDownload,
  section,
  serveStudio,
  stlBounds,
} from './studio-fixture';

test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } });
// Software WebGL on CI runners is several times slower than local GPUs.
test.describe.configure({ timeout: 90_000 });
test.beforeEach(async ({ page }) => {
  await serveStudio(page);
});

test('view selection activates 3D directly and restores independent inspector sections', async ({
  page,
}) => {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${appUrl}?v=1&seed=123`);
  await section(page, 'Colour');
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(page.locator('canvas.terrain-3d')).toBeVisible();
  await section(page, 'Scene');
  await page.getByLabel('Light source').selectOption('moon');
  await page.getByRole('switch', { name: 'Solid base', exact: true }).uncheck();
  await page.getByRole('button', { name: '2D', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Colour settings' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Model', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Scene settings' })).toBeVisible();
  await expect(page.getByLabel('Light source')).toHaveValue('moon');
  await expect(page.getByRole('switch', { name: 'Solid base', exact: true })).not.toBeChecked();
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  await page.getByRole('button', { name: 'Orbit', exact: true }).click();
  await page.getByRole('switch', { name: 'Auto-rotate' }).check();
  await page.getByRole('switch', { name: 'Auto-rotate' }).uncheck();
  await page.getByRole('button', { name: 'Reset camera' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Orbit', exact: true })).toBeFocused();
  await section(page, 'Camera');
  await page.getByLabel('Focal length').fill('5');
  await expect(page.locator('output[for="camera-focal-length"]')).toHaveText('135 mm');
  await page.getByRole('button', { name: 'Orthographic', exact: true }).click();
  await expect(page.getByLabel('Focal length')).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset lens' }).click();
  await expect(page.locator('output[for="camera-focal-length"]')).toHaveText('35 mm');
  await section(page, 'Model');
  await expect(page.getByLabel('Width (X, mm)')).toHaveValue('150');
  await page.screenshot({ path: test.info().outputPath('studio-desktop-model.png') });
  expect(errors).toEqual([]);
});

test('failed WebGL import retains the 2D view and usable controls', async ({ page }) => {
  await page.route('**/assets/terrain-3d-*.js', (route) => route.abort());
  await page.goto(`${appUrl}?v=1&seed=123`);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'WebGL 2' })).toBeVisible();
  await expect(page.getByRole('button', { name: '2D', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('#terrain')).toBeVisible();
  await section(page, 'Contours');
  await page.getByRole('slider', { name: 'Weight', exact: true }).fill('1.5');
  await expect(page.getByRole('slider', { name: 'Weight', exact: true })).toHaveValue('1.5');
});

test('model dimensions reach the exported solid and invalid sizes are flagged', async ({
  page,
}) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await section(page, 'Model');

  for (const [label, value] of [
    ['Width (X, mm)', '180'],
    ['Length (Y, mm)', '90'],
    ['Base thickness (mm)', '6'],
  ]) {
    await page.getByLabel(label, { exact: true }).fill(value);
    await page.getByLabel(label, { exact: true }).press('Tab');
  }

  const bounds = stlBounds(await modelDownload(page));

  expect(bounds[0][1] - bounds[0][0]).toBeCloseTo(180, 3);
  expect(bounds[1][1] - bounds[1][0]).toBeCloseTo(90, 3);
  expect(bounds[2][0]).toBe(0);
  expect(bounds[2][1]).toBeGreaterThan(6);
  await page.getByLabel('Width (X, mm)', { exact: true }).fill('0');
  await page.getByLabel('Width (X, mm)', { exact: true }).press('Tab');
  await expect(page.getByLabel('Width (X, mm)', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
});

test('circle crop gestures and terraces change printable geometry', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await section(page, 'Model');
  await page.getByLabel('Crop shape').selectOption('circle');
  await page.getByLabel('Diameter (mm)', { exact: true }).fill('120');
  await page.getByLabel('Diameter (mm)', { exact: true }).press('Tab');
  const original = await modelDownload(page);
  const bounds = stlBounds(original);

  expect(bounds[0][1] - bounds[0][0]).toBeCloseTo(120, 2);
  expect(bounds[1][1] - bounds[1][0]).toBeCloseTo(120, 2);
  await page.getByRole('slider', { name: 'Crop size', exact: true }).fill('60');
  await page.getByRole('img', { name: /Terrain crop preview/ }).focus();
  await page.keyboard.press('ArrowRight');
  const moved = await modelDownload(page);

  expect(moved.equals(original)).toBe(false);
  await page.getByLabel('Terrain shape', { exact: true }).selectOption('terraced');
  const stepped = await modelDownload(page);

  expect(stepped.equals(moved)).toBe(false);
});

test('materials, gradient stops, engraving and water settings survive view changes', async ({
  page,
}) => {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${appUrl}?v=1&seed=123`);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await section(page, 'Colour');
  await expect(page.getByLabel('Material preset', { exact: true })).toHaveValue('natural');
  await page.getByLabel('Material preset', { exact: true }).selectOption('porcelain');
  await expect(page.getByLabel('Land finish', { exact: true })).toHaveValue('satin');
  await page.getByLabel('Water finish', { exact: true }).selectOption('translucent');
  await page.getByRole('switch', { name: 'Color by elevation' }).check();
  await page.getByLabel('Gradient preset', { exact: true }).selectOption('coastal');
  await page.getByLabel('Transitions', { exact: true }).selectOption('hard');
  await page.getByLabel('Stop 2 color', { exact: true }).fill('#884422');
  await page.getByRole('button', { name: 'Add color stop' }).click();
  await page.getByRole('button', { name: 'Reverse', exact: true }).click();
  await section(page, 'Scene');
  await page.getByRole('slider', { name: 'Water opacity' }).fill('60');
  await page.getByRole('switch', { name: 'Preview water level' }).check();
  await page.getByRole('slider', { name: 'Water level', exact: true }).fill('65');
  await section(page, 'Contours');
  await page.getByLabel('Treatment', { exact: true }).selectOption('engraved');
  await page.getByRole('slider', { name: 'Groove depth' }).fill('0.3');
  await page.getByRole('button', { name: '2D', exact: true }).click();
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await section(page, 'Colour');
  await expect(page.getByRole('switch', { name: 'Color by elevation' })).toBeChecked();
  await expect(page.getByLabel('Transitions', { exact: true })).toHaveValue('hard');
  await expect(page.getByLabel('Gradient preset', { exact: true })).toHaveValue('custom');
  expect(errors).toEqual([]);
});

test('real location controls share contour intervals and export model attribution', async ({
  page,
}) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await loadLocation(page);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await section(page, 'Contours');
  await page.getByLabel('Interval mode').selectOption('fixed');
  await page.getByLabel('Interval (m)').fill('50');
  await page.getByLabel('Interval (m)').press('Tab');
  await page.getByRole('button', { name: 'Overlays', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Map grid', exact: true })).toBeEnabled();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Export ↗' }).click();
  const credit = await download(page, 'Download attribution');

  expect(credit.filename).toContain('attribution.txt');
  expect(credit.bytes.toString()).toContain('Copernicus');
  const stl = await download(page, 'Download STL');

  expect(stl.bytes.readUInt32LE(80)).toBeGreaterThan(0);
});

test('cartographic floor styles repaint the floor without changing the STL', async ({ page }) => {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${appUrl}?v=1&seed=123`);
  await loadLocation(page);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.getByRole('button', { name: 'Export ↗' }).click();
  const before = await download(page, 'Download STL');

  await page.keyboard.press('Escape');

  for (const style of ['survey', 'plinth', 'rose', 'graticule', 'crop']) {
    await page.getByRole('button', { name: 'Overlays', exact: true }).click();
    await page.getByLabel('Floor style', { exact: true }).selectOption(style);
    await page.keyboard.press('Escape');
  }

  await page.getByRole('button', { name: 'Overlays', exact: true }).click();
  await page.getByLabel('Floor style', { exact: true }).selectOption('rose');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Export ↗' }).click();
  const after = await download(page, 'Download STL');

  expect(after.bytes.equals(before.bytes)).toBe(true);
  expect(errors).toEqual([]);
});

test('portrait mobile model and gradient editors fit the studio sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${appUrl}?v=1&seed=123`);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await section(page, 'Model');
  await page.getByLabel('Crop shape').selectOption('circle');
  const preview = page.getByRole('img', { name: /Terrain crop preview/ });
  const bounds = await preview.boundingBox();

  expect(bounds?.width).toBeLessThan(390);
  await section(page, 'Colour');
  await page.getByRole('switch', { name: 'Color by elevation' }).check();
  await page.getByRole('button', { name: 'Add color stop' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: test.info().outputPath('studio-mobile-gradient.png') });
});
