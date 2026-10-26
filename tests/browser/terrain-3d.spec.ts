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

  await expect(page.getByRole('switch', { name: 'Studio floor', exact: true })).toBeChecked();
  await expect(page.getByRole('switch', { name: 'Solid base', exact: true })).toBeChecked();
  await expect(page.getByRole('switch', { name: 'North arrow', exact: true })).toBeDisabled();
  await expect(page.getByRole('switch', { name: 'Map grid', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Water style')).toHaveValue('solid');
  await expect(page.getByRole('combobox', { name: 'Material preset', exact: true })).toHaveValue(
    'natural',
  );
  await expect(page.getByRole('combobox', { name: 'Land finish', exact: true })).toHaveValue(
    'natural',
  );
  await expect(page.getByRole('combobox', { name: 'Water finish', exact: true })).toHaveValue(
    'satin',
  );
  await expect(page.getByRole('switch', { name: 'Match terrain', exact: true })).not.toBeChecked();
  await expect(page.getByLabel('Water color', { exact: true })).toHaveValue('#36666b');
  await expect(page.getByLabel('Surface tint', { exact: true })).toHaveValue('#ffffff');
  await expect(page.locator('#terrain-light-fill')).toHaveValue('0.7');
  await expect(page.getByLabel('Light source')).toHaveValue('sun');
  await expect(page.locator('#terrain-light-elevation')).toHaveValue('35');
  await expect(height).toHaveValue('0.3');
  await expect(height).toHaveAttribute('max', '1');
  // User choices replace the defaults and survive toggling the preview.
  await page.getByRole('combobox', { name: 'Land finish', exact: true }).selectOption('matte');
  await page.getByRole('switch', { name: 'Match background', exact: true }).check();
  await page.getByRole('switch', { name: 'Match terrain', exact: true }).check();
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
  await page.getByLabel('Light source').selectOption('moon');
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  const moon = PNG.sync.read(await page.screenshot({ clip })).data;

  expect(moon.equals(relit)).toBe(false);
  await page.getByRole('button', { name: 'Expand controls' }).click();
  await page.getByLabel('Light source').selectOption('off');
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  const unlit = PNG.sync.read(await page.screenshot({ clip })).data;

  expect(unlit.equals(moon)).toBe(false);
  await page.getByRole('button', { name: 'Expand controls' }).click();
  await page.getByRole('button', { name: 'Reset lighting', exact: true }).click();
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  const reset = PNG.sync.read(await page.screenshot({ clip })).data;

  expect(reset.equals(baseline)).toBe(true);
  await page.getByRole('button', { name: 'Expand controls' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Canvas', { exact: true }).fill('#334455');
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(page.getByLabel('Floor color', { exact: true })).toHaveValue('#b4b4b4');
  await expect(page.getByLabel('Floor color', { exact: true })).toBeEnabled();
  await page.getByRole('switch', { name: 'Match canvas', exact: true }).check();
  await expect(page.getByLabel('Floor color', { exact: true })).toHaveValue('#334455');
  await expect(page.getByLabel('Floor color', { exact: true })).toBeDisabled();
  await page.getByRole('switch', { name: 'Match canvas', exact: true }).uncheck();
  await page.getByLabel('Floor color', { exact: true }).fill('#8899aa');
  await expect(page.getByLabel('Surface color')).toHaveValue('#334455');
  await page.getByRole('switch', { name: 'Match background' }).uncheck();
  await page.getByLabel('Surface color').fill('#667788');
  await expect(page.getByLabel('Water color', { exact: true })).toHaveValue('#5a6978');
  await page.getByRole('switch', { name: 'Match terrain', exact: true }).uncheck();
  await page.getByLabel('Water color', { exact: true }).fill('#123456');
  await height.fill('0.5');
  await page.getByRole('switch', { name: 'Show raised contours' }).uncheck();
  await expect(page.locator('#terrain')).toBeVisible();
  await page.getByRole('switch', { name: 'Show raised contours' }).check();
  await expect(page.getByLabel('Water color', { exact: true })).toHaveValue('#123456');
  await expect(page.getByLabel('Floor color', { exact: true })).toHaveValue('#8899aa');
  await expect(height).toHaveValue('0.5');
  await expect(page.getByLabel('Land finish')).toHaveValue('matte');
  await expect(page.getByLabel('Surface color')).toHaveValue('#667788');
  await expect(page.getByRole('switch', { name: 'Contour lines', exact: true })).not.toBeChecked();
  await page.getByRole('switch', { name: 'Show land surface' }).uncheck();
  await expect(page.getByLabel('Surface color')).toBeHidden();
  expect(errors).toEqual([]);
});

test('material presets pair colors and allow independent finishes across view changes', async ({
  page,
}) => {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${appUrl}?v=1&seed=123`);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.getByRole('switch', { name: 'Show raised contours' }).check();

  for (const [preset, land, water, finish] of [
    ['porcelain', '#e9e2d3', '#165b62', 'satin'],
    ['plaster', '#eeeae2', '#728b98', 'matte'],
    ['terracotta', '#b96b4e', '#174c57', 'matte'],
    ['slate', '#42494e', '#172b36', 'matte'],
  ]) {
    await page.getByLabel('Material preset').selectOption(preset);
    await expect(page.getByLabel('Surface color')).toHaveValue(land);
    await expect(page.getByLabel('Water color', { exact: true })).toHaveValue(water);
    await expect(page.getByLabel('Land finish')).toHaveValue(finish);
    await expect(
      page.getByRole('switch', { name: 'Match terrain', exact: true }),
    ).not.toBeChecked();
  }

  await page.getByLabel('Water finish').selectOption('satin');
  await expect(page.getByLabel('Material preset')).toHaveValue('custom');
  await expect(page.getByLabel('Land finish')).toHaveValue('matte');
  await page.getByRole('switch', { name: 'Show raised contours' }).uncheck();
  await page.getByRole('switch', { name: 'Show raised contours' }).check();
  await expect(page.getByLabel('Water finish')).toHaveValue('satin');
  await expect(page.getByLabel('Surface color')).toHaveValue('#42494e');
  expect(errors).toEqual([]);
});

test('translucent water reveals flooded terrain and retains opacity across view changes', async ({
  page,
}) => {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${appUrl}?v=1&seed=123`);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.getByRole('switch', { name: 'Show raised contours' }).check();
  await page.getByLabel('Material preset').selectOption('porcelain');
  await page.getByRole('switch', { name: 'Solid base', exact: true }).check();
  await page.getByRole('switch', { name: 'Preview water level', exact: true }).check();
  await page.getByLabel('Water finish').selectOption('translucent');
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  const clip = { x: 100, y: 150, width: 650, height: 450 };
  const transparent = PNG.sync.read(await page.screenshot({ clip })).data;

  await page.getByRole('button', { name: 'Expand controls' }).click();
  await page.getByRole('slider', { name: 'Water opacity' }).fill('100');
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  const opaque = PNG.sync.read(await page.screenshot({ clip })).data;

  expect(opaque.equals(transparent)).toBe(false);
  await page.getByRole('button', { name: 'Expand controls' }).click();
  await page.getByRole('slider', { name: 'Water opacity' }).fill('25');
  await page.getByRole('switch', { name: 'Show raised contours' }).uncheck();
  await page.getByRole('switch', { name: 'Show raised contours' }).check();
  await expect(page.getByRole('slider', { name: 'Water opacity' })).toHaveValue('25');
  await expect(
    page.getByRole('switch', { name: 'Preview water level', exact: true }),
  ).toBeChecked();
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

test('dimensioned STL matches the model and remains stable across viewport and appearance changes', async ({
  page,
}) => {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.goto(`${appUrl}?v=1&seed=123`);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.getByRole('switch', { name: 'Show raised contours' }).check();
  await expect(page.getByLabel('Width (X, mm)', { exact: true })).toHaveValue('150');
  await expect(page.getByLabel('Length (Y, mm)', { exact: true })).toHaveValue('150');
  await page.getByLabel('Width (X, mm)', { exact: true }).fill('180');
  await page.getByLabel('Width (X, mm)', { exact: true }).press('Tab');
  await page.getByLabel('Length (Y, mm)', { exact: true }).fill('90');
  await page.getByLabel('Length (Y, mm)', { exact: true }).press('Tab');
  await page.getByLabel('Base thickness (mm)', { exact: true }).fill('6');
  await page.getByLabel('Base thickness (mm)', { exact: true }).press('Tab');
  await page.getByRole('switch', { name: 'Solid base', exact: true }).check();

  const downloadStl = async () => {
    const pending = page.waitForEvent('download');

    await page.getByRole('button', { name: 'Download STL', exact: true }).click();
    const download = await pending;

    expect(download.suggestedFilename()).toBe('topogra-123-180x90mm.stl');
    const path = await download.path();

    if (!path) {
      throw new Error('STL download is unavailable.');
    }

    return readFile(path);
  };

  await page.screenshot({ path: test.info().outputPath('print-preview.png') });
  const original = await downloadStl();

  expect(original.length).toBe(84 + original.readUInt32LE(80) * 50);
  const bounds = [
    [Infinity, -Infinity],
    [Infinity, -Infinity],
    [Infinity, -Infinity],
  ];

  for (let triangle = 0; triangle < original.readUInt32LE(80); triangle++) {
    for (let vertex = 0; vertex < 3; vertex++) {
      for (let axis = 0; axis < 3; axis++) {
        const value = original.readFloatLE(84 + triangle * 50 + 12 + vertex * 12 + axis * 4);

        bounds[axis][0] = Math.min(bounds[axis][0], value);
        bounds[axis][1] = Math.max(bounds[axis][1], value);
      }
    }
  }

  expect(bounds[0][1] - bounds[0][0]).toBeCloseTo(180, 3);
  expect(bounds[1][1] - bounds[1][0]).toBeCloseTo(90, 3);
  expect(bounds[2][0]).toBe(0);
  expect(bounds[2][1]).toBeGreaterThan(6);

  await page.setViewportSize({ width: 1200, height: 700 });
  // Wait for the existing 2D resize debounce; printable framing must remain unchanged.
  await page.waitForTimeout(400);
  await page.getByLabel('Light source').selectOption('moon');
  await page.getByRole('switch', { name: 'Solid base', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Reset camera', exact: true }).click();
  expect((await downloadStl()).equals(original)).toBe(true);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Canvas', { exact: true }).fill('#556677');
  await page.getByRole('button', { name: '3D', exact: true }).click();
  expect((await downloadStl()).equals(original)).toBe(true);

  await page.getByLabel('Width (X, mm)', { exact: true }).fill('0');
  await page.getByLabel('Width (X, mm)', { exact: true }).press('Tab');
  await expect(page.getByLabel('Width (X, mm)', { exact: true })).toHaveValue('180');
  await expect(page.locator('#panel-status')).toContainText('between 1 and 1000');
  expect((await downloadStl()).equals(original)).toBe(true);
  await page.getByRole('slider', { name: 'Height exaggeration' }).fill('0');
  await expect(page.locator('[data-model-height]')).toHaveText('6 mm');
  expect((await downloadStl()).equals(original)).toBe(false);
  expect(errors).toEqual([]);
});

test('loaded location models export STL and companion attribution', async ({ page }) => {
  const tile = new PNG({ width: 256, height: 256 });

  for (let offset = 0; offset < tile.data.length; offset += 4) {
    tile.data[offset] = 128;
    tile.data[offset + 1] = 10;
    tile.data[offset + 3] = 255;
  }

  await page.route('https://s3.amazonaws.com/elevation-tiles-prod/**', (route) =>
    route.fulfill({
      body: PNG.sync.write(tile),
      contentType: 'image/png',
      headers: {
        'access-control-allow-origin': '*',
        'x-amz-meta-x-imagery-sources': 'eudem/test.tif',
      },
    }),
  );
  await page.goto(`${appUrl}?v=1&seed=123`);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.getByRole('switch', { name: 'Show raised contours' }).check();
  const originalHeight = await page.locator('[data-model-height]').textContent();

  await page.getByRole('button', { name: 'Location', exact: true }).click();
  await page.getByRole('button', { name: 'Load terrain', exact: true }).click();
  await expect(page.locator('[data-status]')).toContainText('Real terrain loaded');
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(page.locator('#terrain-light-direction')).toHaveValue('120');
  await expect(page.locator('#terrain-light-elevation')).toHaveValue('35');
  await expect(page.locator('#terrain-light-fill')).toHaveValue('0.7');
  await expect(page.locator('[data-model-credit]')).toContainText('Copernicus');
  await expect(page.locator('[data-model-height]')).toHaveText('3 mm');
  expect(originalHeight).not.toBe('3 mm');
  const pending = page.waitForEvent('download');

  await page.getByRole('button', { name: 'Download STL', exact: true }).click();
  const download = await pending;
  const stlPath = await download.path();

  if (!stlPath) {
    throw new Error('STL download is unavailable.');
  }

  const stl = await readFile(stlPath);

  expect(stl.length).toBe(84 + stl.readUInt32LE(80) * 50);
  await expect(page.getByRole('switch', { name: 'North arrow', exact: true })).toBeEnabled();
  await expect(page.getByRole('switch', { name: 'North arrow', exact: true })).toBeChecked();
  await expect(page.getByRole('switch', { name: 'Map grid', exact: true })).toBeChecked();
  await expect(page.getByRole('switch', { name: 'Solid base', exact: true })).toBeChecked();
  await page.getByRole('switch', { name: 'North arrow', exact: true }).uncheck();
  await page.getByRole('switch', { name: 'Map grid', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  const groundOnly = await page.screenshot();

  await page.getByRole('button', { name: 'Expand controls' }).click();
  await expect(page.getByRole('switch', { name: 'Map grid', exact: true })).toBeEnabled();
  await page.getByRole('switch', { name: 'Map grid', exact: true }).check();
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  const withGrid = await page.screenshot({ path: test.info().outputPath('ground-map-grid.png') });

  expect(withGrid.equals(groundOnly)).toBe(false);
  await page.getByRole('button', { name: 'Expand controls' }).click();
  await page.getByRole('switch', { name: 'Show raised contours' }).uncheck();
  await page.getByRole('switch', { name: 'Show raised contours' }).check();
  await expect(page.getByRole('switch', { name: 'Map grid', exact: true })).toBeChecked();
  await page.getByRole('switch', { name: 'Map grid', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Collapse controls' }).click();

  await page.getByRole('button', { name: 'Expand controls' }).click();
  await page.getByRole('switch', { name: 'North arrow', exact: true }).check();
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  const arrow = await page.screenshot({ path: test.info().outputPath('ground-north-arrow.png') });

  expect(arrow.equals(groundOnly)).toBe(false);
  await page.getByRole('button', { name: 'Expand controls' }).click();
  await page.getByRole('switch', { name: 'Match canvas', exact: true }).uncheck();
  await page.getByLabel('Floor color', { exact: true }).fill('#778899');
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  const customFloor = await page.screenshot();

  expect(customFloor.equals(arrow)).toBe(false);
  await page.getByRole('button', { name: 'Expand controls' }).click();
  await page.getByRole('switch', { name: 'Studio floor', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  const noGround = await page.screenshot();

  expect(noGround.equals(groundOnly)).toBe(false);
  await page.getByRole('button', { name: 'Expand controls' }).click();
  const stagedExport = page.waitForEvent('download');

  await page.getByRole('button', { name: 'Download STL', exact: true }).click();
  const stagedPath = await (await stagedExport).path();

  if (!stagedPath) {
    throw new Error('STL download is unavailable.');
  }

  expect((await readFile(stagedPath)).equals(stl)).toBe(true);
  const pendingCredit = page.waitForEvent('download');

  await page.getByRole('button', { name: 'Download attribution', exact: true }).click();
  const creditPath = await (await pendingCredit).path();

  if (!creditPath) {
    throw new Error('Attribution download is unavailable.');
  }

  expect(await readFile(creditPath, 'utf8')).toContain('Copernicus');
  await page.getByRole('button', { name: 'Location', exact: true }).click();
  await page.locator('#terrain-place').selectOption({ label: 'Cape Town — Table Mountain' });
  await page.getByRole('button', { name: 'Load terrain', exact: true }).click();
  await expect(page.locator('[data-status]')).toContainText('Real terrain loaded');
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(page.locator('#terrain-light-direction')).toHaveValue('60');
  await page.locator('#terrain-light-direction').fill('270');
  await page.getByRole('button', { name: 'Location', exact: true }).click();
  await page.locator('#terrain-place').selectOption({ label: 'Croagh Patrick' });
  await page.getByRole('button', { name: 'Load terrain', exact: true }).click();
  await expect(page.locator('[data-status]')).toContainText('Real terrain loaded');
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(page.locator('#terrain-light-direction')).toHaveValue('270');
  await page.getByRole('button', { name: 'Reset lighting', exact: true }).click();
  await expect(page.locator('#terrain-light-direction')).toHaveValue('120');
});

test('circle crops can be resized and moved on the mini-map and export matching solids', async ({
  page,
}) => {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${appUrl}?v=1&seed=123`);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.getByRole('switch', { name: 'Show raised contours' }).check();
  await page.getByLabel('Crop shape', { exact: true }).selectOption('circle');
  await expect(page.getByLabel('Diameter (mm)', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Length (Y, mm)', { exact: true })).toBeHidden();
  const preview = page.locator('[data-crop-preview]');

  await expect(preview).toHaveAttribute('data-crop-shape', 'circle');
  await expect(page.locator('[data-crop-size]')).toHaveValue('100');

  const downloadStl = async () => {
    const pending = page.waitForEvent('download');

    await page.getByRole('button', { name: 'Download STL', exact: true }).click();
    const download = await pending;

    expect(download.suggestedFilename()).toBe('topogra-123-circle-150mm.stl');
    const path = await download.path();

    if (!path) {
      throw new Error('STL download is unavailable.');
    }

    return readFile(path);
  };

  const full = await downloadStl();

  // Every exported vertex must lie inside the actual circular footprint, not just a visual mask.
  let maximumRadius = 0;

  for (let triangle = 0; triangle < full.readUInt32LE(80); triangle++) {
    for (let vertex = 0; vertex < 3; vertex++) {
      const offset = 84 + triangle * 50 + 12 + vertex * 12;

      maximumRadius = Math.max(
        maximumRadius,
        Math.hypot(full.readFloatLE(offset), full.readFloatLE(offset + 4)),
      );
    }
  }

  expect(maximumRadius).toBeLessThanOrEqual(75.00001);
  await page.locator('[data-crop-size]').fill('60');
  await expect(page.locator('[data-crop-size-value]')).toHaveText('60%');
  await preview.scrollIntoViewIfNeeded();
  const startCenter = await preview.getAttribute('data-crop-center');
  const box = await preview.boundingBox();

  if (!box) {
    throw new Error('Crop preview is unavailable.');
  }

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 25, box.y + box.height / 2 - 15, { steps: 4 });
  await page.mouse.up();
  await expect(preview).not.toHaveAttribute('data-crop-center', startCenter ?? '');
  expect((await downloadStl()).equals(full)).toBe(false);
  await preview.scrollIntoViewIfNeeded();
  const handle = await page.locator('[data-crop-handles] circle').nth(1).boundingBox();

  if (!handle) {
    throw new Error('Crop resize handle is unavailable.');
  }

  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + 12, handle.y + handle.height / 2, {
    steps: 4,
  });
  await page.mouse.up();
  await expect
    .poll(async () => Number(await page.locator('[data-crop-size]').inputValue()))
    .toBeGreaterThan(60);
  await preview.focus();
  const moved = await preview.getAttribute('data-crop-center');

  await page.keyboard.press('ArrowLeft');
  await expect(preview).not.toHaveAttribute('data-crop-center', moved ?? '');
  await page.getByRole('button', { name: 'Reset crop', exact: true }).click();
  await expect(page.locator('[data-crop-size]')).toHaveValue('100');
  expect((await downloadStl()).equals(full)).toBe(true);
  await page.getByRole('switch', { name: 'Solid base', exact: true }).check();
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  await page.screenshot({ path: test.info().outputPath('circular-terrain-model.png') });
  await page.getByRole('button', { name: 'Expand controls' }).click();
  await preview.scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath('circle-crop-preview.png') });
  await page.getByLabel('Crop shape', { exact: true }).selectOption('rectangle');
  await expect(page.getByLabel('Width (X, mm)', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Length (Y, mm)', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('crop controls remain usable on a portrait mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${appUrl}?v=1&seed=123`);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.getByRole('switch', { name: 'Show raised contours' }).check();
  await page.getByLabel('Crop shape', { exact: true }).selectOption('circle');
  await page.getByRole('slider', { name: 'Crop size', exact: true }).fill('50');
  const preview = page.locator('[data-crop-preview]');

  await preview.scrollIntoViewIfNeeded();
  await preview.focus();
  const center = await preview.getAttribute('data-crop-center');

  await page.keyboard.press('ArrowDown');
  await expect(preview).not.toHaveAttribute('data-crop-center', center ?? '');
  const handle = await page.locator('[data-crop-handles] circle').first().boundingBox();

  expect(handle?.width).toBeGreaterThanOrEqual(11);
  await page.screenshot({ path: test.info().outputPath('mobile-circle-crop.png') });
  await page.getByRole('button', { name: 'Reset crop', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Crop size', exact: true })).toHaveValue('100');
});

test('studio color surrounds the model and directional lighting casts a real floor shadow', async ({
  page,
}) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.getByRole('switch', { name: 'Show raised contours' }).check();
  await page.getByRole('switch', { name: 'Solid base', exact: true }).check();
  await expect(page.getByLabel('Floor color', { exact: true })).toHaveValue('#b4b4b4');
  await page.getByLabel('Base thickness (mm)', { exact: true }).fill('20');
  await page.getByLabel('Base thickness (mm)', { exact: true }).press('Tab');
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  const sunImage = await page.screenshot({
    path: test.info().outputPath('studio-cast-shadow.png'),
  });
  const sun = PNG.sync.read(sunImage);

  // The top corners used to expose the unrelated canvas/sky color.
  for (const x of [10, sun.width - 10]) {
    const index = (10 * sun.width + x) * 4;

    expect(Array.from(sun.data.subarray(index, index + 3))).toEqual([180, 180, 180]);
  }

  await page.getByRole('button', { name: 'Expand controls' }).click();
  await page.getByLabel('Light source').selectOption('off');
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  const off = PNG.sync.read(await page.screenshot());
  let shadowPixels = 0;

  for (let offset = 0; offset < off.data.length; offset += 4) {
    if (
      off.data[offset] === 180 &&
      off.data[offset + 1] === 180 &&
      off.data[offset + 2] === 180 &&
      sun.data[offset] < 170 &&
      Math.abs(sun.data[offset] - sun.data[offset + 1]) <= 1 &&
      Math.abs(sun.data[offset] - sun.data[offset + 2]) <= 1
    ) {
      shadowPixels++;
    }
  }

  expect(shadowPixels).toBeGreaterThan(1000);
});

test('natural materials render both crop shapes and leave printable geometry unchanged', async ({
  page,
}) => {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  await page.goto(`${appUrl}?v=1&seed=123`);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.getByRole('switch', { name: 'Show raised contours' }).check();

  const download = async () => {
    const pending = page.waitForEvent('download');

    await page.getByRole('button', { name: 'Download STL', exact: true }).click();
    const file = await (await pending).path();

    if (!file) {
      throw new Error('Missing STL download.');
    }

    return readFile(file);
  };

  const original = await download();

  await page
    .getByRole('combobox', { name: 'Material preset', exact: true })
    .selectOption('natural');
  await expect(page.getByRole('combobox', { name: 'Land finish', exact: true })).toHaveValue(
    'natural',
  );
  await expect(
    page.getByRole('switch', { name: 'Use natural palette', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  const natural = await page.screenshot({ path: test.info().outputPath('natural-landscape.png') });

  await page.getByRole('button', { name: 'Expand controls' }).click();
  expect((await download()).equals(original)).toBe(true);
  await page.getByRole('combobox', { name: 'Land finish', exact: true }).selectOption('matte');
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  expect((await page.screenshot()).equals(natural)).toBe(false);
  await page.getByRole('button', { name: 'Expand controls' }).click();
  await page.getByRole('combobox', { name: 'Land finish', exact: true }).selectOption('natural');
  await page.getByLabel('Crop shape', { exact: true }).selectOption('circle');
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  await page.screenshot({ path: test.info().outputPath('natural-circle.png') });
  await page.getByRole('button', { name: 'Expand controls' }).click();
  await page.getByRole('switch', { name: 'Show raised contours' }).uncheck();
  await page.getByRole('switch', { name: 'Show raised contours' }).check();
  await expect(page.getByRole('combobox', { name: 'Land finish', exact: true })).toHaveValue(
    'natural',
  );
  expect(errors).toEqual([]);
});

test('real locations use meter intervals through hatching, cropping, height and view changes', async ({
  page,
}) => {
  const errors: string[] = [];
  const tile = new PNG({ width: 256, height: 256 });

  for (let i = 0; i < tile.data.length; i += 4) {
    const encoded = 32768 + ((i / 4) % 256) * 2;

    tile.data[i] = Math.floor(encoded / 256);
    tile.data[i + 1] = encoded % 256;
    tile.data[i + 3] = 255;
  }

  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://s3.amazonaws.com/elevation-tiles-prod/**', (route) =>
    route.fulfill({
      body: PNG.sync.write(tile),
      contentType: 'image/png',
      headers: {
        'access-control-allow-origin': '*',
        'x-amz-meta-x-imagery-sources': 'eudem/test.tif',
      },
    }),
  );
  await page.goto(`${appUrl}?v=1&seed=123`);
  await page.getByRole('button', { name: 'Location', exact: true }).click();
  await page.getByRole('button', { name: 'Load terrain', exact: true }).click();
  await expect(page.locator('[data-status]')).toContainText('Real terrain loaded');
  await expect(page.locator('[data-contour-summary]')).toHaveText('Contours: 20 m (Auto)');
  await page.getByRole('combobox', { name: 'Interval mode', exact: true }).selectOption('fixed');
  await expect(page.getByLabel('Interval (m)', { exact: true })).toBeVisible();
  await expect(page.locator('[data-contour-summary]')).toHaveText('Contours: 25 m (Fixed)');
  const paths = page.locator('#terrain [data-contour-interval-m]');

  await expect(paths.first()).toHaveAttribute('data-contour-interval-m', '25');
  const original = await paths.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('d')),
  );

  await page.getByLabel('Interval (m)', { exact: true }).fill('0');
  await page.getByLabel('Interval (m)', { exact: true }).press('Tab');
  await expect(page.locator('[data-contour-summary]')).toContainText('1 to 5000');
  expect(
    await paths.evaluateAll((elements) => elements.map((element) => element.getAttribute('d'))),
  ).toEqual(original);
  await page.getByLabel('Interval (m)', { exact: true }).fill('25');
  await page.getByLabel('Interval (m)', { exact: true }).press('Tab');
  await page.getByRole('switch', { name: 'Sea-level hatching', exact: true }).uncheck();
  await expect(page.locator('[data-contour-summary]')).toHaveText('Contours: 25 m (Fixed)');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Density', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.getByRole('switch', { name: 'Show raised contours', exact: true }).check();
  await expect(page.locator('[data-contour-interval]')).toHaveText('Contours: 25 m');
  await page.getByRole('combobox', { name: 'Terrain shape', exact: true }).selectOption('terraced');
  await expect(page.locator('[data-layer-height]')).toHaveText('1.147 mm');
  await page.getByRole('slider', { name: 'Height exaggeration' }).fill('0.8');
  await expect(page.locator('[data-layer-height]')).toHaveText('3.059 mm');
  await page.getByRole('combobox', { name: 'Crop shape', exact: true }).selectOption('circle');
  await page.getByRole('slider', { name: 'Crop size', exact: true }).fill('60');
  await expect(page.locator('[data-contour-interval]')).toHaveText('Contours: 25 m');
  await page.getByRole('switch', { name: 'Show raised contours', exact: true }).uncheck();
  await page.getByRole('switch', { name: 'Show raised contours', exact: true }).check();
  await expect(page.locator('[data-contour-interval]')).toHaveText('Contours: 25 m');
  await page.getByRole('button', { name: 'Location', exact: true }).click();
  await page.getByRole('button', { name: 'Use generated', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Density', exact: true })).toBeEnabled();
  expect(errors).toEqual([]);
});

test('engraved contours react to light on natural and satin surfaces without changing STL', async ({
  page,
}) => {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  await page.goto(`${appUrl}?v=1&seed=123`);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.getByRole('switch', { name: 'Show raised contours', exact: true }).check();

  const download = async () => {
    const pending = page.waitForEvent('download');

    await page.getByRole('button', { name: 'Download STL', exact: true }).click();
    const file = await (await pending).path();

    if (!file) {
      throw new Error('Missing STL download.');
    }

    return readFile(file);
  };

  const original = await download();

  await page.getByRole('combobox', { name: 'Treatment', exact: true }).selectOption('engraved');
  await page.getByRole('slider', { name: 'Groove width', exact: true }).fill('1');
  await page.getByRole('slider', { name: 'Groove depth', exact: true }).fill('0.3');
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  await page.screenshot({ path: test.info().outputPath('engraved-natural.png') });
  await page.getByRole('button', { name: 'Expand controls' }).click();
  await page
    .getByRole('combobox', { name: 'Material preset', exact: true })
    .selectOption('porcelain');
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  const engraved = PNG.sync.read(
    await page.screenshot({ path: test.info().outputPath('engraved-porcelain.png') }),
  );

  await page.getByRole('button', { name: 'Expand controls' }).click();
  await page.getByRole('slider', { name: 'Groove depth', exact: true }).fill('0');
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  const plain = PNG.sync.read(await page.screenshot());
  let changed = 0;

  for (let i = 0; i < plain.data.length; i += 4) {
    if (Math.abs(plain.data[i] - engraved.data[i]) > 8) {
      changed++;
    }
  }

  expect(changed).toBeGreaterThan(1000);
  await page.getByRole('button', { name: 'Expand controls' }).click();
  await page.getByRole('slider', { name: 'Groove depth', exact: true }).fill('0.3');
  expect((await download()).equals(original)).toBe(true);
  await page.getByRole('switch', { name: 'Contour lines', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  expect(PNG.sync.read(await page.screenshot()).data.equals(plain.data)).toBe(true);
  await page.getByRole('button', { name: 'Expand controls' }).click();
  await page.getByRole('switch', { name: 'Contour lines', exact: true }).check();
  await page.getByRole('slider', { name: 'Height exaggeration' }).fill('0');
  await page.getByRole('combobox', { name: 'Crop shape', exact: true }).selectOption('circle');
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  await page.screenshot({ path: test.info().outputPath('engraved-flat-circle.png') });
  await page.getByRole('button', { name: 'Expand controls' }).click();
  await page.getByRole('switch', { name: 'Show raised contours', exact: true }).uncheck();
  await page.getByRole('switch', { name: 'Show raised contours', exact: true }).check();
  await expect(page.getByRole('combobox', { name: 'Treatment', exact: true })).toHaveValue(
    'engraved',
  );
  await expect(page.getByRole('slider', { name: 'Groove depth', exact: true })).toHaveValue('0.3');
  expect(errors).toEqual([]);
});

test('terraced shape exports real shelves and risers, retains contour treatment and restores Smooth', async ({
  page,
}) => {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  await page.goto(`${appUrl}?v=1&seed=123`);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.getByRole('switch', { name: 'Show raised contours', exact: true }).check();

  const download = async () => {
    const pending = page.waitForEvent('download');

    await page.getByRole('button', { name: 'Download STL', exact: true }).click();
    const path = await (await pending).path();

    if (!path) {
      throw new Error('Missing STL download.');
    }

    return readFile(path);
  };

  const smooth = await download();

  await page.getByRole('combobox', { name: 'Terrain shape', exact: true }).selectOption('terraced');
  await expect(page.locator('[data-layer-height]')).toContainText('mm');
  await page.getByRole('switch', { name: 'Contour lines', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  await page.screenshot({ path: test.info().outputPath('terraced-natural.png') });
  await page.getByRole('button', { name: 'Expand controls' }).click();
  const terraced = await download();

  expect(terraced.equals(smooth)).toBe(false);
  let shelves = 0;
  let risers = 0;
  let sloped = 0;
  const triangles = terraced.readUInt32LE(80);

  for (let i = 0; i < triangles; i++) {
    const nz = Math.abs(terraced.readFloatLE(84 + i * 50 + 8));

    if (!(nz < 1e-5 || Math.abs(nz - 1) < 1e-5)) {
      sloped++;
    }

    if (nz > 0.99) {
      shelves++;
    } else {
      risers++;
    }
  }

  expect(sloped).toBe(0);
  expect(shelves).toBeGreaterThan(100);
  expect(risers).toBeGreaterThan(100);
  await page.getByRole('combobox', { name: 'Treatment', exact: true }).selectOption('engraved');
  expect((await download()).equals(terraced)).toBe(true);
  await page.getByRole('switch', { name: 'Contour lines', exact: true }).check();
  await page
    .getByRole('combobox', { name: 'Material preset', exact: true })
    .selectOption('porcelain');
  await page.getByRole('combobox', { name: 'Crop shape', exact: true }).selectOption('circle');
  await page.getByRole('switch', { name: 'Preview water level', exact: true }).check();
  await page
    .getByRole('combobox', { name: 'Water finish', exact: true })
    .selectOption('translucent');
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  await page.screenshot({ path: test.info().outputPath('terraced-circle-water.png') });
  await page.getByRole('button', { name: 'Expand controls' }).click();
  expect((await download()).readUInt32LE(80)).toBeGreaterThan(100);
  await page.getByRole('switch', { name: 'Show raised contours', exact: true }).uncheck();
  await page.getByRole('switch', { name: 'Show raised contours', exact: true }).check();
  await expect(page.getByRole('combobox', { name: 'Terrain shape', exact: true })).toHaveValue(
    'terraced',
  );
  await expect(page.getByRole('combobox', { name: 'Treatment', exact: true })).toHaveValue(
    'engraved',
  );
  await page.getByRole('combobox', { name: 'Terrain shape', exact: true }).selectOption('smooth');
  await page.getByRole('combobox', { name: 'Crop shape', exact: true }).selectOption('rectangle');
  expect((await download()).equals(smooth)).toBe(true);
  expect(errors).toEqual([]);
});

test('elevation gradients edit and retain stops, render hard and soft bands, and preserve STL', async ({
  page,
}) => {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  await page.goto(`${appUrl}?v=1&seed=123`);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.getByRole('switch', { name: 'Show raised contours', exact: true }).check();
  await page.getByRole('switch', { name: 'Contour lines', exact: true }).uncheck();

  const download = async () => {
    const pending = page.waitForEvent('download');

    await page.getByRole('button', { name: 'Download STL', exact: true }).click();
    const path = await (await pending).path();

    if (!path) {
      throw new Error('Missing STL download.');
    }

    return readFile(path);
  };

  const original = await download();

  await expect(
    page.getByRole('switch', { name: 'Color by elevation', exact: true }),
  ).not.toBeChecked();
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  const baseline = await page.screenshot();

  await page.getByRole('button', { name: 'Expand controls' }).click();
  await page.getByRole('switch', { name: 'Color by elevation', exact: true }).check();
  await expect(page.getByLabel('Surface tint', { exact: true })).toBeHidden();

  for (const preset of ['paper', 'sandstone', 'ember', 'copper', 'coastal']) {
    await page.getByRole('combobox', { name: 'Gradient preset', exact: true }).selectOption(preset);
    await expect(page.locator('[data-gradient-preview]')).toHaveAttribute(
      'style',
      /linear-gradient/,
    );
  }

  await page.getByRole('combobox', { name: 'Gradient preset', exact: true }).selectOption('paper');
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  const soft = await page.screenshot({ path: test.info().outputPath('gradient-smooth-soft.png') });

  expect(soft.equals(baseline)).toBe(false);
  await page.getByRole('button', { name: 'Expand controls' }).click();
  await page.getByRole('combobox', { name: 'Transitions', exact: true }).selectOption('hard');
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  expect(
    (await page.screenshot({ path: test.info().outputPath('gradient-smooth-hard.png') })).equals(
      soft,
    ),
  ).toBe(false);
  await page.getByRole('button', { name: 'Expand controls' }).click();
  await page.getByRole('switch', { name: 'Color by elevation', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  expect((await page.screenshot()).equals(baseline)).toBe(true);
  await page.getByRole('button', { name: 'Expand controls' }).click();
  await page.getByRole('switch', { name: 'Color by elevation', exact: true }).check();
  await page.getByRole('combobox', { name: 'Transitions', exact: true }).selectOption('soft');
  await page.getByLabel('Stop 2 color', { exact: true }).fill('#c46b35');
  await expect(page.getByRole('combobox', { name: 'Gradient preset', exact: true })).toHaveValue(
    'custom',
  );
  await page.getByRole('spinbutton', { name: 'Stop 2 position', exact: true }).fill('35');
  await page.getByRole('spinbutton', { name: 'Stop 2 position', exact: true }).press('Tab');
  await expect(page.getByRole('spinbutton', { name: 'Stop 2 position', exact: true })).toHaveValue(
    '35',
  );
  await page.getByRole('button', { name: 'Add color stop', exact: true }).click();
  await page.getByRole('button', { name: 'Add color stop', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add color stop', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Remove stop 2', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add color stop', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Reverse', exact: true }).click();
  await expect(page.getByLabel('Stop 1 color', { exact: true })).toHaveValue('#f5f3ec');
  expect((await download()).equals(original)).toBe(true);
  await page.getByRole('combobox', { name: 'Terrain shape', exact: true }).selectOption('terraced');
  await page
    .getByRole('combobox', { name: 'Gradient preset', exact: true })
    .selectOption('sandstone');
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  await page.screenshot({ path: test.info().outputPath('gradient-terraced-sandstone.png') });
  await page.getByRole('button', { name: 'Expand controls' }).click();
  await page
    .getByRole('combobox', { name: 'Material preset', exact: true })
    .selectOption('porcelain');
  await page.getByRole('combobox', { name: 'Gradient preset', exact: true }).selectOption('ember');
  await page.getByRole('combobox', { name: 'Crop shape', exact: true }).selectOption('circle');
  await page.getByRole('combobox', { name: 'Treatment', exact: true }).selectOption('engraved');
  await page.getByRole('switch', { name: 'Contour lines', exact: true }).check();
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  await page.screenshot({ path: test.info().outputPath('gradient-terraced-ember.png') });
  await page.getByRole('button', { name: 'Expand controls' }).click();
  await page.getByRole('switch', { name: 'Show raised contours', exact: true }).uncheck();
  await page.getByRole('switch', { name: 'Show raised contours', exact: true }).check();
  await expect(page.getByRole('switch', { name: 'Color by elevation', exact: true })).toBeChecked();
  await expect(page.getByRole('combobox', { name: 'Gradient preset', exact: true })).toHaveValue(
    'ember',
  );
  await expect(page.getByRole('combobox', { name: 'Transitions', exact: true })).toHaveValue(
    'soft',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Stop 1 color', { exact: true }).scrollIntoViewIfNeeded();
  expect(
    await page
      .locator('[data-gradient-stops]')
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await page.screenshot({ path: test.info().outputPath('gradient-controls-mobile.png') });
  expect(errors).toEqual([]);
});
