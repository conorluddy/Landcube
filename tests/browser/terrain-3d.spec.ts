import { expect, test, type Page } from '@playwright/test';
import {
  appUrl,
  download,
  enter3D,
  loadLocation,
  modelDownload,
  openDefaultStudio,
  section,
  serveStudio,
  stlBounds,
} from './studio-fixture';

test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } });
test.beforeEach(async ({ page }) => {
  await serveStudio(page);
});

test('fresh visits open Errigal in 3D and reload to the same default', async ({ page }) => {
  await openDefaultStudio(page);
  await expect(page.locator('canvas.terrain-3d')).toBeVisible();
  await expect(page.locator('#terrain')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Coordinates', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('#terrain-place')).toHaveValue('55.0343,-8.113');
  expect(new URL(page.url()).search).toBe('');
  await page.reload();
  await expect(page.getByRole('button', { name: '3D', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('#terrain-place')).toHaveValue('55.0343,-8.113');
});

test('fresh visits without WebGL 2 show the default location in 2D', async ({ page }) => {
  await page.route('**/assets/terrain-3d-*.js', (route) => route.abort());
  await page.goto(appUrl);
  await expect(page.getByRole('status').filter({ hasText: 'WebGL 2' })).toBeVisible();
  await expect(page.getByRole('button', { name: '2D', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('status').filter({ hasText: 'Real terrain loaded' })).toBeVisible();
  await expect(page.locator('#terrain')).toBeVisible();
});

test('view selection activates 3D directly and restores independent inspector sections', async ({
  page,
}) => {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${appUrl}?v=1&seed=123`);
  await section(page, 'Colour');
  await enter3D(page);
  await section(page, 'Scene');
  await page.getByLabel('Time of day').fill('2');
  await expect(page.locator('output[for="terrain-light-time"]')).toHaveText('02:00 · Night');
  await page.getByRole('switch', { name: 'Solid base', exact: true }).uncheck();
  await page.getByRole('button', { name: '2D', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Colour settings' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Model', exact: true })).toHaveCount(0);
  await enter3D(page);
  await expect(page.getByRole('region', { name: 'Scene settings' })).toBeVisible();
  await expect(page.getByLabel('Time of day')).toHaveValue('2');
  await expect(page.getByRole('switch', { name: 'Solid base', exact: true })).not.toBeChecked();
  expect(errors).toEqual([]);
});

// Split from the view test: auto-rotate keeps software WebGL busy and slows every action.
test('orbit controls set the turntable and reset to an isometric camera', async ({ page }) => {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${appUrl}?v=1&seed=123`);
  await enter3D(page);
  await section(page, 'Orbit');
  await page.getByRole('switch', { name: 'Auto-rotate' }).check();
  await page.getByRole('button', { name: 'Clockwise', exact: true }).click();
  await page.getByLabel('Rotation speed').fill('60');
  await expect(page.locator('output[for="orbit-rotation-seconds"]')).toHaveText('60 s per turn');
  await page.getByRole('switch', { name: 'Auto-rotate' }).uncheck();
  await expect(page.getByLabel('Rotation speed')).toBeDisabled();
  await page.getByRole('button', { name: 'Isometric', exact: true }).click();
  await page.getByRole('button', { name: 'Reset camera', exact: true }).click();
  expect(errors).toEqual([]);
});

test('camera settings switch projection, focus and lens effects, then reset', async ({ page }) => {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${appUrl}?v=1&seed=123`);
  await enter3D(page);
  await section(page, 'Orbit');
  await page.getByRole('button', { name: 'Isometric', exact: true }).click();
  await section(page, 'Camera');
  await expect(page.getByRole('button', { name: 'Orthographic', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Perspective', exact: true }).click();
  await page.getByLabel('Focal length').fill('5');
  await expect(page.locator('output[for="camera-focal-length"]')).toHaveText('135 mm');
  await page.getByRole('button', { name: 'Orthographic', exact: true }).click();
  await expect(page.getByLabel('Focal length')).toHaveCount(0);
  await page.getByRole('button', { name: 'Depth of field', exact: true }).click();
  await expect(page.getByText('Depth of field needs perspective projection.')).toBeVisible();
  await page.getByRole('button', { name: 'Perspective', exact: true }).click();
  await page.getByLabel('Aperture').fill('0');
  await expect(page.locator('output[for="camera-aperture"]')).toHaveText('f/1.4');
  // A second pick supersedes the first instead of leaving its listeners behind.
  await page.getByRole('button', { name: 'Pick focus', exact: true }).click();
  await page.getByRole('button', { name: 'Pick focus', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Click the terrain' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('status').filter({ hasText: 'Focus unchanged.' })).toBeVisible();
  await expect(page.locator('canvas.terrain-3d')).toHaveCSS('cursor', 'auto');
  // Escape cancels the pick only; the inspector stays open.
  await expect(page.getByRole('region', { name: 'Camera settings' })).toBeVisible();
  await page.getByRole('button', { name: 'Tilt-shift', exact: true }).click();
  await page.getByLabel('Band width').fill('40');
  await expect(page.locator('output[for="camera-tiltShiftWidth"]')).toHaveText('40%');
  await page.getByLabel('Exposure', { exact: true }).fill('0.5');
  await expect(page.locator('output[for="camera-exposure"]')).toHaveText('+0.5 EV');
  await page.getByRole('button', { name: 'Reset camera settings' }).click();
  await expect(page.locator('output[for="camera-focal-length"]')).toHaveText('35 mm');
  await expect(page.getByRole('button', { name: 'Perspective', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Off', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
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
  await enter3D(page);
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
  await enter3D(page);
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
  await enter3D(page);
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
  await enter3D(page);
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
  await enter3D(page);
  await section(page, 'Contours');
  await page.getByLabel('Interval mode').selectOption('fixed');
  await page.getByLabel('Interval (m)').fill('50');
  await page.getByLabel('Interval (m)').press('Tab');
  await section(page, 'Overlays');
  await expect(page.getByRole('switch', { name: 'Map grid', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Export ↗' }).click();
  const credit = await download(page, 'Download attribution');

  expect(credit.filename).toContain('attribution.txt');
  expect(credit.bytes.toString()).toContain('Copernicus');
  const stl = await download(page, 'Download STL');

  expect(stl.bytes.readUInt32LE(80)).toBeGreaterThan(0);
  const canvasWidth = await page
    .locator('canvas.terrain-3d')
    .evaluate((canvas) => canvas.clientWidth);
  const still = await download(page, 'Download 3D still');

  expect(still.filename).toContain('3d-2x.png');
  // PNG IHDR stores the pixel width big-endian at byte 16.
  expect(still.bytes.readUInt32BE(16)).toBe(canvasWidth * 2);
  await expect(page.getByRole('status').filter({ hasText: '3D still' })).toBeVisible();
});

test('cartographic floor styles repaint the floor without changing the STL', async ({ page }) => {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${appUrl}?v=1&seed=123`);
  await loadLocation(page);
  await enter3D(page);
  await page.getByRole('button', { name: 'Export ↗' }).click();
  const before = await download(page, 'Download STL');

  await page.keyboard.press('Escape');

  await section(page, 'Overlays');

  for (const style of ['survey', 'plinth', 'rose', 'graticule', 'crop']) {
    await page.getByLabel('Floor style', { exact: true }).selectOption(style);
  }

  await page.getByLabel('Floor style', { exact: true }).selectOption('rose');
  await page.getByRole('button', { name: 'Export ↗' }).click();
  const after = await download(page, 'Download STL');

  expect(after.bytes.equals(before.bytes)).toBe(true);
  expect(errors).toEqual([]);
});

test('portrait mobile model and gradient editors fit the studio sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${appUrl}?v=1&seed=123`);
  await enter3D(page);
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

test('3D terrain morphs between landscapes and settles on the destination', async ({ page }) => {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${appUrl}?v=1&seed=123`);
  await enter3D(page);
  const canvas = page.locator('canvas.terrain-3d');
  const transitions = await recordTerrainTransitions(page);
  // Software WebGL can spend a whole morph inside one frame, so count recorded morphs, never poll for one.
  const morphCount = async () =>
    (await transitions()).filter((state) => state === 'morphing').length;
  const settle = () =>
    expect(canvas).toHaveAttribute('data-terrain-transition', 'settled', { timeout: 10_000 });

  await loadLocation(page);
  await page.screenshot({ path: test.info().outputPath('terrain-morph-mid.png') });
  await settle();
  await page.screenshot({ path: test.info().outputPath('terrain-morph-settled.png') });
  expect(await morphCount()).toBe(1);
  await page.getByRole('button', { name: 'Procedural', exact: true }).click();
  await expect.poll(morphCount).toBe(2);
  await settle();
  await page.getByRole('button', { name: 'New landscape', exact: true }).click();
  await page.getByRole('button', { name: 'New landscape', exact: true }).click();
  await expect.poll(morphCount).toBeGreaterThan(2);
  await settle();
  expect(errors).toEqual([]);
});

test('reduced motion swaps 3D terrain without morphing', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${appUrl}?v=1&seed=123`);
  await enter3D(page);
  const transitions = await recordTerrainTransitions(page);

  await loadLocation(page);
  await page.getByRole('button', { name: 'Procedural', exact: true }).click();
  await page.getByRole('button', { name: 'New landscape', exact: true }).click();
  // The new seed renders on the next frame; a frame queued after it runs once it has.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  expect(await transitions()).not.toContain('morphing');
  await expect(page.locator('canvas.terrain-3d')).toHaveAttribute(
    'data-terrain-transition',
    'settled',
  );
});

/** Records every state the 3D canvas reports, so a fast morph cannot slip between polls. */
async function recordTerrainTransitions(page: Page): Promise<() => Promise<string[]>> {
  await expect(page.locator('canvas.terrain-3d')).toBeVisible();
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('canvas.terrain-3d');
    const states: string[] = [];

    if (!canvas) {
      throw new Error('3D canvas is missing.');
    }

    Object.assign(window, { terrainTransitions: states });
    new MutationObserver(() => {
      states.push(canvas.dataset.terrainTransition ?? '');
    }).observe(canvas, { attributeFilter: ['data-terrain-transition'] });
  });

  return () =>
    page.evaluate(() => (window as unknown as { terrainTransitions: string[] }).terrainTransitions);
}

test('mapped roads retry after a busy service, restyle without refetching and credit OpenStreetMap', async ({
  page,
}) => {
  const errors: string[] = [];
  const queries: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://overpass-api.de/api/interpreter', async (route) => {
    queries.push(new URLSearchParams(route.request().postData() ?? '').get('data') ?? '');
    const headers = { 'access-control-allow-origin': '*' };

    // The public instance answers 502 under load; the first request plays that part.
    if (queries.length === 1) {
      await route.fulfill({ status: 502, headers });

      return;
    }

    // Synthetic ways near the default preset; real responses carry the same shape.
    await route.fulfill({
      json: {
        elements: [
          syntheticWay(1, 'primary', {}),
          syntheticWay(2, 'track', {}),
          syntheticWay(3, 'secondary', { bridge: 'yes' }),
        ],
      },
      headers,
    });
  });
  await page.goto(`${appUrl}?v=1&seed=123`);
  await loadLocation(page);
  await enter3D(page);
  await section(page, 'Overlays');
  await page.getByRole('switch', { name: 'Mapped roads', exact: true }).check();
  await expect(page.getByRole('status').filter({ hasText: 'busy' })).toBeVisible();
  await page.getByLabel('Road width').fill('1.5');
  expect(queries).toHaveLength(1);
  await page.getByRole('button', { name: 'Retry download', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: /mapped road/ })).toBeFocused();
  await expect(page.getByText('1 mapped road · 1 bridge and 0 tunnels hidden.')).toBeVisible();
  await page.getByLabel('Detail').selectOption('tracks');
  await expect(page.getByText('2 mapped roads · 1 bridge and 0 tunnels hidden.')).toBeVisible();
  await page.getByLabel('Road width').fill('2');
  await page.getByRole('switch', { name: 'Mapped roads', exact: true }).uncheck();
  await page.getByRole('switch', { name: 'Mapped roads', exact: true }).check();
  await expect(
    page.locator('footer a.attribution').filter({ hasText: 'OpenStreetMap' }),
  ).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
  expect(queries).toHaveLength(2);
  expect(queries[1]).toContain('way["highway"');

  await section(page, 'Model');
  await page.getByLabel('Terrain shape', { exact: true }).selectOption('terraced');
  await section(page, 'Overlays');
  await expect(page.getByText('Roads are hidden on terraced models.')).toBeVisible();
  await expect(page.locator('footer a.attribution')).toHaveCount(0);
  expect(errors).toEqual([]);
});

function syntheticWay(id: number, highway: string, tags: Record<string, string>) {
  return {
    type: 'way',
    id,
    tags: { highway, ...tags },
    geometry: Array.from({ length: 12 }, (_, index) => ({
      lat: 55.01 + index * 0.0015 * id,
      lon: -8.15 + index * 0.006,
    })),
  };
}

test('grass restyles without errors and never changes the printable STL', async ({ page }) => {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${appUrl}?v=1&seed=123`);
  await loadLocation(page);
  await enter3D(page);
  const before = await modelDownload(page);
  const canvas = page.locator('canvas.terrain-3d');
  const bare = await canvas.screenshot();

  await section(page, 'Scene');
  await page.getByRole('switch', { name: 'Grass', exact: true }).check();
  // The carpet must actually draw, not just restyle without errors.
  await expect.poll(async () => (await canvas.screenshot()).equals(bare)).toBe(false);
  await page.getByLabel('Look', { exact: true }).selectOption('autumn');
  await page.getByLabel('Blade length', { exact: true }).fill('2');
  await expect(page.getByLabel('Look', { exact: true })).toHaveValue('custom');
  await page.getByLabel('Density', { exact: true }).fill('400');
  expect((await modelDownload(page)).equals(before)).toBe(true);
  expect(errors).toEqual([]);
});
