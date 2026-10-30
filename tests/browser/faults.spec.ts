import { expect, test, type Page, type Route } from '@playwright/test';
import { appUrl, loadLocation, section, serveStudio, terrainTileUrl } from './studio-fixture';

test.beforeEach(async ({ page }) => {
  await serveStudio(page);
});

/** Moves off the bundled default place, so Load terrain reaches the (routed) tile service. */
async function prepareDistantLocation(page: Page): Promise<void> {
  await page.goto(`${appUrl}?v=1&seed=123&width=320&height=240`);
  await loadLocation(page);
  await section(page, 'Terrain');
  await page.getByLabel('Latitude', { exact: true }).fill('10');
  await page.getByLabel('Latitude', { exact: true }).press('Tab');
}

/** Each tile answers `staggerMs` later than the previous one, so progress rises one tile at a time. */
async function staggerTiles(page: Page, staggerMs: number): Promise<void> {
  let requestCount = 0;

  await page.route(terrainTileUrl, async (route: Route) => {
    const delayMs = staggerMs * ++requestCount;

    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.fallback().catch(() => undefined);
  });
}

function readTileCounts(detail: string | null): { loaded: number; total: number } {
  const match = /(\d+) of (\d+) tiles/.exec(detail ?? '');

  return { loaded: Number(match?.[1] ?? -1), total: Number(match?.[2] ?? 0) };
}

test('a failed tile request shows a fault card with its code, and Retry requests again', async ({
  page,
}) => {
  await prepareDistantLocation(page);
  let tileRequests = 0;

  const failTiles = (route: Route) => {
    tileRequests++;

    return route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' } });
  };

  await page.route(terrainTileUrl, failTiles);
  await page.getByRole('button', { name: 'Load terrain', exact: true }).click();
  const fault = page.getByRole('alert').filter({ hasText: /E-2\d\d/ });

  await expect(fault).toBeVisible();
  await expect(fault).toContainText('E-201');
  await expect(fault).toContainText('download failed');
  await expect(page.getByRole('status').filter({ hasText: 'download failed' })).toBeVisible();

  const requestsBeforeRetry = tileRequests;

  await fault.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect.poll(() => tileRequests).toBeGreaterThan(requestsBeforeRetry);

  await page.unroute(terrainTileUrl, failTiles);
  await fault.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Real terrain loaded' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('the loader card counts tiles up while terrain downloads, then goes away', async ({
  page,
}) => {
  await prepareDistantLocation(page);
  await staggerTiles(page, 350);
  await page.getByRole('button', { name: 'Load terrain', exact: true }).click();
  const loader = page.getByRole('status').filter({ hasText: /Loading terrain/ });
  const detail = loader.locator('.lc-loader-card__detail');

  await expect(detail).toBeVisible();
  const total = readTileCounts(await detail.textContent()).total;

  expect(total).toBeGreaterThan(1);
  await expect
    .poll(async () => readTileCounts(await detail.textContent()).loaded)
    .toBeGreaterThan(0);
  await expect(loader.getByRole('progressbar')).toHaveAttribute('aria-valuenow', /0\.\d+/);
  await expect(page.locator('.lc-tile-resolve__sweep')).toHaveCSS(
    'animation-name',
    'lc-tile-resolve-sweep',
  );
  await expect(page.getByRole('status').filter({ hasText: 'Real terrain loaded' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(loader).toHaveCount(0);
});

test('cancel stops the download and keeps the studio usable', async ({ page }) => {
  await prepareDistantLocation(page);
  await staggerTiles(page, 1500);
  await page.getByRole('button', { name: 'Load terrain', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'cancelled' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Load terrain', exact: true })).toBeEnabled();
  await expect(page.locator('.lc-loader-card')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('reduced motion turns the scan sweep off', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await prepareDistantLocation(page);
  await staggerTiles(page, 700);
  await page.getByRole('button', { name: 'Load terrain', exact: true }).click();
  const sweep = page.locator('.lc-tile-resolve__sweep');

  await expect(sweep).toBeAttached();
  await expect(sweep).toHaveCSS('animation-name', 'none');
});

test('fault cards are full width with 12px insets on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepareDistantLocation(page);
  await page.route(terrainTileUrl, (route) =>
    route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' } }),
  );
  await page.getByRole('button', { name: 'Load terrain', exact: true }).click();
  const box = await page.getByRole('alert').filter({ hasText: 'E-201' }).boundingBox();

  expect(box?.x).toBe(12);
  expect(box?.width).toBe(390 - 24);
});
