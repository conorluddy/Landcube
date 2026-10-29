import { expect, test, type Page } from '@playwright/test';
import { appUrl, openDefaultStudio, serveStudio } from './studio-fixture';

test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } });
test.beforeEach(async ({ page }) => {
  await serveStudio(page);
});

function readoutCard(page: Page) {
  return page.getByRole('region', { name: 'Target lock' });
}

/** Drags across the 3D canvas in small steps, like a hand orbiting the camera. */
async function orbitDrag(page: Page, distancePx: number, steps: number): Promise<void> {
  await page.mouse.move(450, 400);
  await page.mouse.down();

  for (let step = 1; step <= steps; step++) {
    await page.mouse.move(450 + (distancePx * step) / steps, 400);
    await page.waitForTimeout(16);
  }

  await page.mouse.up();
}

test('the Target lock card shows on desktop and leaves the page on short or phone viewports', async ({
  page,
}) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await expect(readoutCard(page)).toBeVisible();
  await expect(readoutCard(page)).toContainText('Seed 123');

  for (const viewport of [
    { width: 1280, height: 650 },
    { width: 1280, height: 699 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(readoutCard(page)).toHaveCount(0);
    await expect(page.locator('.lc-readout-card')).toHaveAttribute('hidden');
  }

  await page.setViewportSize({ width: 1280, height: 700 });
  await expect(readoutCard(page)).toBeVisible();
});

test('the crosshair follows the pointer over the viewport and hides over UI surfaces', async ({
  page,
}) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  const crosshair = page.locator('[data-hud] .lc-crosshair');
  const inspector = await page
    .getByRole('complementary', { name: 'Landscape controls' })
    .boundingBox();
  const card = await readoutCard(page).boundingBox();

  if (inspector === null || card === null) {
    throw new Error('Inspector or readout card is not laid out.');
  }

  await expect(crosshair).toHaveAttribute('data-state', 'hidden');
  await page.mouse.move(400, 300, { steps: 3 });
  await expect(crosshair).toHaveAttribute('data-state', 'tracking');
  await expect(crosshair).toHaveAttribute('style', /--lc-crosshair-x:\s*400px/);
  await expect(crosshair.locator('.lc-coordinate-tip')).toContainText(/^E [\d,]+ mS [\d,]+ m$/);

  for (const point of [
    { x: inspector.x + 150, y: inspector.y + 300 },
    { x: card.x + 150, y: card.y + 100 },
  ]) {
    await page.mouse.move(point.x, point.y);
    await expect(crosshair).toHaveAttribute('data-state', 'hidden');
  }
});

test('real terrain shows its source and attribution in the card and footer', async ({ page }) => {
  await openDefaultStudio(page);
  const attribution = await page.locator('footer .attribution').first().textContent();

  expect(attribution).toBeTruthy();
  await expect(readoutCard(page)).toContainText(attribution ?? '');
  await expect(readoutCard(page)).toContainText('Errigal');
  await expect(page.locator('details.mobile-attribution')).toHaveCount(1);
});

test('the compass turns with an orbit drag and pose updates stay at 20 a second', async ({
  page,
}) => {
  await openDefaultStudio(page);
  const compass = page.locator('[data-hud] .lc-compass');

  await expect(compass).toHaveAttribute('data-azimuth', /\d+/);
  const before = await compass.getAttribute('data-azimuth');

  await compass.evaluate((element) => {
    const times: number[] = [];

    new MutationObserver(() => times.push(performance.now())).observe(element, {
      attributes: true,
      attributeFilter: ['data-azimuth'],
    });
    Object.assign(window, { compassUpdateTimes: times });
  });
  await orbitDrag(page, 600, 60);
  await expect.poll(() => compass.getAttribute('data-azimuth')).not.toBe(before);

  const updateTimes = await page.evaluate(
    () => (window as unknown as { compassUpdateTimes: number[] }).compassUpdateTimes,
  );
  const gapsMs = updateTimes.slice(1).map((time, index) => time - updateTimes[index]);
  // Commits land a millisecond either side of the 50ms publish spacing, so check the mean rate.
  const updatesPerSecond =
    (gapsMs.length * 1000) / (updateTimes[updateTimes.length - 1] - updateTimes[0]);

  expect(updateTimes.length).toBeGreaterThan(10);
  expect(updatesPerSecond).toBeLessThanOrEqual(20.5);
  expect(Math.min(...gapsMs)).toBeGreaterThan(40);
});
