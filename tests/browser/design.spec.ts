import { expect, test, type Route } from '@playwright/test';
import { PNG } from 'pngjs';
import {
  appUrl,
  download,
  loadLocation,
  openDefaultStudio,
  section,
  serveStudio,
  terrainTileUrl,
} from './studio-fixture';

test.beforeEach(async ({ page }) => {
  await serveStudio(page);
});

test('studio separates view, inspector and shortcuts while retaining settings', async ({
  page,
}) => {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${appUrl}?v=1&seed=234`);
  await expect(
    page.getByRole('navigation', { name: 'Editing section' }).getByRole('button'),
  ).toHaveText(['Terrain', 'Contours', 'Colour', 'Scene']);
  await section(page, 'Contours');

  await section(page, 'Colour');
  await page.getByRole('button', { name: 'Paper', exact: true }).click();
  await section(page, 'Contours');
  await page.getByRole('slider', { name: 'Weight', exact: true }).fill('1.5');
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  await expect(page.getByRole('button', { name: 'Overlays', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Overlays', exact: true }).click();
  await page.getByLabel('Grid style').selectOption('crosses');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Overlays', exact: true })).toBeFocused();
  await section(page, 'Contours');
  await expect(page.getByRole('slider', { name: 'Weight', exact: true })).toHaveValue('1.5');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Expand controls' })).toBeFocused();
  expect(errors).toEqual([]);
});

test('copy style link and reopening preserve version-one settings and exclude session state', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (value: string) => {
          document.documentElement.dataset.copiedLink = value;

          return Promise.resolve();
        },
      },
    });
  });
  await page.goto(`${appUrl}?v=1&seed=234&width=480&height=320`);
  await page.getByRole('slider', { name: 'Terrain detail', exact: true }).fill('0.99');
  await section(page, 'Colour');
  await page.getByRole('button', { name: 'Paper', exact: true }).click();
  await page.getByRole('button', { name: 'Export ↗' }).click();
  await page.getByLabel('Transparent background').check();
  await page.getByLabel('Format', { exact: true }).selectOption('png');
  await page.getByLabel('Resolution', { exact: true }).selectOption('2');
  await page.getByRole('button', { name: 'Close Export' }).click();
  await page.getByRole('button', { name: 'Copy style link', exact: true }).click();
  const url = await page.locator('html').getAttribute('data-copied-link');

  expect(url).not.toBeNull();

  if (url === null) {
    throw new Error('Link unavailable');
  }

  expect(new URL(url).searchParams.get('v')).toBe('1');
  await page.goto(url);
  await expect(page.getByRole('slider', { name: 'Terrain detail', exact: true })).toHaveValue(
    '0.99',
  );
  await section(page, 'Colour');
  await expect(page.getByRole('button', { name: 'Paper', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Export ↗' }).click();
  await expect(page.getByLabel('Transparent background')).toBeChecked();
  await expect(page.getByLabel('Width', { exact: true })).toHaveValue('480');
  await expect(page.getByLabel('Resolution', { exact: true })).toHaveValue('2');
});

test('SVG and PNG exports preserve settled dimensions and transparency', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123&width=320&height=240&cursorEnabled=false`);
  await page.getByRole('button', { name: 'Export ↗' }).click();
  const opaque = await download(page, 'Download SVG');

  expect(opaque.bytes.toString()).toContain('fill="#202326"');
  await page.getByLabel('Transparent background').check();
  const transparent = await download(page, 'Download SVG');

  expect(transparent.filename).toBe('topogra-123-320x240.svg');
  expect(transparent.bytes.toString()).not.toContain('fill="#202326"');
  const preview = page.getByAltText('Settled landscape export preview');

  await expect(preview).toBeVisible();
  await expect
    .poll(async () =>
      preview.evaluate(async (image) =>
        // A replaced preview's blob URL is revoked mid-fetch; treat that as not-yet-settled.
        fetch((image as HTMLImageElement).src)
          .then((response) => response.text())
          .catch(() => ''),
      ),
    )
    .toBe(transparent.bytes.toString());
  await page.getByLabel('Format', { exact: true }).selectOption('png');

  for (const scale of [1, 2]) {
    await page.getByLabel('Resolution', { exact: true }).selectOption(String(scale));
    const exported = await download(page, 'Download PNG');
    const png = PNG.sync.read(exported.bytes);

    expect([png.width, png.height, png.data[3]]).toEqual([320 * scale, 240 * scale, 0]);
  }
});

test('output validation, size presets and extra-large opt-in remain consistent', async ({
  page,
}) => {
  await page.goto(`${appUrl}?v=1&seed=1&width=320&height=240`);
  await page.getByRole('button', { name: 'Export ↗' }).click();
  await page.getByLabel('Width', { exact: true }).fill('0');
  await page.getByLabel('Width', { exact: true }).press('Tab');
  await expect(page.getByLabel('Width', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('button', { name: 'Download SVG' })).toBeDisabled();
  await page.getByLabel('Width', { exact: true }).fill('480');
  await page.getByLabel('Width', { exact: true }).press('Tab');
  await expect(page.getByRole('button', { name: 'Download SVG' })).toBeEnabled();
  await page.getByLabel('Allow extra-large exports').check();
  await page.getByLabel('Width', { exact: true }).fill('8192');
  await page.getByLabel('Width', { exact: true }).press('Tab');
  await page.getByLabel('Allow extra-large exports').uncheck();
  await expect(page.getByLabel('Width', { exact: true })).toHaveValue('4096');
  await page.getByLabel('Format', { exact: true }).selectOption('png');
  await page.getByLabel('Resolution', { exact: true }).selectOption('2');
  await expect(page.getByRole('button', { name: 'Download PNG' })).toBeDisabled();
  await page.getByLabel('Size', { exact: true }).selectOption('1920x1080');
  await expect(page.getByLabel('Width', { exact: true })).toHaveValue('1920');
  await expect(page.getByRole('button', { name: 'Download PNG' })).toBeEnabled();
});

test('mobile shell, clipboard fallback and dialog focus remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  });
  await page.goto(`${appUrl}?v=1&seed=123&lineColor=invalid`);
  await expect(page.getByRole('status').filter({ hasText: 'lineColor' })).toBeVisible();
  const inspector = page.getByRole('complementary', { name: 'Landscape controls' });
  const bounds = await inspector.boundingBox();

  expect(bounds?.width).toBe(390);
  expect(bounds?.height).toBeLessThanOrEqual(844 * 0.62);
  await page.getByRole('button', { name: 'Copy style link', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Copy style link' })).toBeVisible();
  await expect(page.getByLabel('Copy this link')).toHaveValue(/seed=123/);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Copy style link', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Export ↗' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Export ↗' })).toBeFocused();
  await expect(inspector).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('studio-mobile.png') });
});

test('seed lock persists, palette randomization and scoped reset preserve output', async ({
  page,
}) => {
  await page.goto(`${appUrl}?v=1&seed=456&width=480&height=320`);
  await page.getByRole('switch', { name: 'Lock seed' }).check();
  await expect(page.getByRole('button', { name: 'New landscape' })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Lock seed' })).toBeChecked();
  await section(page, 'Colour');
  const background = await page.getByLabel('Canvas color').inputValue();

  await page.getByRole('button', { name: 'Random', exact: true }).click();
  await expect(page.getByLabel('Canvas color')).not.toHaveValue(background);
  expect(new URL(page.url()).searchParams.get('seed')).toBe('456');
  await page.getByRole('button', { name: 'Reset design style' }).click();
  await expect(page.getByLabel('Canvas color')).toHaveValue('#202326');
  await page.getByRole('button', { name: 'Export ↗' }).click();
  await expect(page.getByLabel('Width', { exact: true })).toHaveValue('480');
});

test('real terrain interval, overlays and failed loading retain the current landscape', async ({
  page,
}) => {
  await page.goto(`${appUrl}?v=1&seed=123&width=320&height=240`);
  await loadLocation(page);
  await section(page, 'Contours');
  await expect(page.getByRole('slider', { name: 'Density' })).toHaveCount(0);
  await page.getByLabel('Interval mode').selectOption('fixed');
  await page.getByLabel('Interval (m)').fill('50');
  await page.getByLabel('Interval (m)').press('Tab');
  await expect(page.getByText(/Contours: 50 m/)).toBeVisible();
  await page.getByRole('button', { name: 'Overlays', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Sea-level hatching' })).toBeChecked();
  await page.getByLabel('Grid style').selectOption('squares');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Export ↗' }).click();
  const original = await download(page, 'Download SVG');

  expect(original.bytes.toString()).toContain('<metadata>Produced using Copernicus');
  expect(original.bytes.toString()).toContain('grid');
  await page.getByRole('button', { name: 'Close Export' }).click();
  await page.route(terrainTileUrl, (route) => route.abort());
  await section(page, 'Terrain');
  await page.getByLabel('Latitude', { exact: true }).fill('10');
  await page.getByLabel('Latitude', { exact: true }).press('Tab');
  await page.getByRole('button', { name: 'Load terrain', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Load terrain', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Export ↗' }).click();
  expect((await download(page, 'Download SVG')).bytes.equals(original.bytes)).toBe(true);
  await page.getByRole('button', { name: 'Close Export' }).click();
  await page.getByRole('button', { name: 'Procedural', exact: true }).click();
  await expect(page.getByText('Procedural landscape')).toBeVisible();
  await section(page, 'Contours');
  await expect(page.getByRole('slider', { name: 'Density' })).toBeVisible();
});

test('real terrain switches back instantly and revisited places load from the tile cache', async ({
  page,
}) => {
  await page.goto(`${appUrl}?v=1&seed=123&width=320&height=240`);
  await loadLocation(page);
  let tileRequests = 0;

  page.on('request', (request) => {
    if (request.url().includes('/terrarium/')) {
      tileRequests++;
    }
  });
  await page.getByRole('button', { name: 'Procedural', exact: true }).click();
  await expect(page.getByText(/^Procedural · /)).toBeVisible();
  await page.getByRole('button', { name: 'Coordinates', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Real terrain restored' })).toBeVisible();
  expect(tileRequests).toBe(0);

  await page.reload();
  await page.getByRole('button', { name: 'Coordinates', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Real terrain loaded' })).toBeVisible();
  expect(tileRequests).toBe(0);
});

test('coordinates edited before switching away load fresh terrain instead of restoring', async ({
  page,
}) => {
  await page.goto(`${appUrl}?v=1&seed=123&width=320&height=240`);
  await loadLocation(page);
  await page.getByLabel('Latitude', { exact: true }).fill('10');
  await page.getByLabel('Latitude', { exact: true }).press('Tab');
  await page.getByRole('button', { name: 'Procedural', exact: true }).click();
  await page.getByRole('button', { name: 'Coordinates', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Real terrain loaded' })).toBeVisible();
});

test('coordinates retries after a failed first load', async ({ page }) => {
  const abortTiles = (route: Route) => route.abort();

  // The default location is bundled, so move off it to reach the tile service.
  await page.goto(`${appUrl}?v=1&seed=123&width=320&height=240`);
  await loadLocation(page);
  await page.getByLabel('Latitude', { exact: true }).fill('10');
  await page.getByLabel('Latitude', { exact: true }).press('Tab');
  await page.getByRole('button', { name: 'Procedural', exact: true }).click();
  await page.route(terrainTileUrl, abortTiles);
  await page.getByRole('button', { name: 'Coordinates', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'download failed' })).toBeVisible();
  await page.unroute(terrainTileUrl, abortTiles);
  await loadLocation(page);
});

test('design links open the 2D procedural design they encode', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=234`);
  await expect(page.getByRole('button', { name: '2D', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Procedural', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('#seed-value')).toHaveText('234');
  await expect(page.locator('#terrain')).toBeVisible();
});

test('fresh visits load the default location from bundled tiles without downloads', async ({
  page,
}) => {
  const tileRequests: string[] = [];

  page.on('request', (request) => {
    if (request.url().includes('/terrarium/')) {
      tileRequests.push(request.url());
    }
  });
  await page.route(terrainTileUrl, (route) => route.abort());
  await openDefaultStudio(page);
  expect(tileRequests).toEqual([]);
  await expect(page.locator('.attribution')).toContainText('Copernicus');
});

test('footer tour button plays and pauses autoplay', async ({ page }) => {
  await openDefaultStudio(page);
  await page.getByRole('button', { name: 'Play tour', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause tour', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await section(page, 'Terrain');
  await expect(page.getByRole('switch', { name: 'Tour preset locations' })).toBeChecked();
  await page.getByRole('button', { name: 'Pause tour', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Tour preset locations' })).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Play tour', exact: true })).toBeVisible();
});

test('failed preview decoding retains the last image and obsolete previews cannot replace newer output', async ({
  page,
}) => {
  await page.goto(`${appUrl}?v=1&seed=123&width=320&height=240`);
  await page.getByRole('button', { name: 'Export ↗' }).click();
  const preview = page.getByAltText('Settled landscape export preview');

  await expect(preview).toBeVisible();
  const original = await preview.getAttribute('src');

  await page.evaluate(() => {
    const decode = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'decode')?.value as (
      this: HTMLImageElement,
    ) => Promise<void>;

    HTMLImageElement.prototype.decode = function () {
      if (document.documentElement.dataset.failPreview === 'true') {
        return Promise.reject(new Error('Preview decode unavailable'));
      }

      if (document.documentElement.dataset.holdPreview === 'true') {
        document.documentElement.dataset.holdPreview = 'false';

        return decode.call(this).then(
          () =>
            new Promise<void>((resolve) => {
              (window as unknown as { releasePreview: () => void }).releasePreview = resolve;
            }),
        );
      }

      return decode.call(this);
    };

    document.documentElement.dataset.failPreview = 'true';
  });
  await page.getByLabel('Width', { exact: true }).fill('340');
  await page.getByLabel('Width', { exact: true }).press('Tab');
  await expect(page.getByRole('alert')).toContainText('Preview decode unavailable');
  await expect(preview).toHaveAttribute('src', original ?? '');
  await page.evaluate(() => {
    document.documentElement.dataset.failPreview = 'false';
    document.documentElement.dataset.holdPreview = 'true';
  });
  await page.getByLabel('Width', { exact: true }).fill('350');
  await page.getByLabel('Width', { exact: true }).press('Tab');
  await page.waitForFunction(() => 'releasePreview' in window);
  await page.getByLabel('Width', { exact: true }).fill('360');
  await page.getByLabel('Width', { exact: true }).press('Tab');
  await expect
    .poll(async () =>
      preview.evaluate(async (image) =>
        // A replaced preview's blob URL is revoked mid-fetch; treat that as not-yet-settled.
        fetch((image as HTMLImageElement).src)
          .then((response) => response.text())
          .catch(() => ''),
      ),
    )
    .toContain('width="360"');
  await page.evaluate(() => {
    (window as unknown as { releasePreview: () => void }).releasePreview();
  });
  await expect
    .poll(async () =>
      preview.evaluate(async (image) =>
        // A replaced preview's blob URL is revoked mid-fetch; treat that as not-yet-settled.
        fetch((image as HTMLImageElement).src)
          .then((response) => response.text())
          .catch(() => ''),
      ),
    )
    .toContain('width="360"');
});
