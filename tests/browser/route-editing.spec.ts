import { expect, test, type Page } from '@playwright/test';
import { appUrl, loadLocation, readDownload, serveStudio } from './studio-fixture';

test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } });
// Software WebGL on CI runners is several times slower than local GPUs.
test.describe.configure({ timeout: 90_000 });
test.beforeEach(async ({ page }) => {
  await serveStudio(page);
});

// Clear of the header, tool pill, floating Finish bar and inspector.
const clickPoints = [
  { x: 420, y: 420 },
  { x: 520, y: 330 },
  { x: 620, y: 430 },
];

function routeTool(page: Page) {
  return page
    .getByRole('group', { name: 'Tool' })
    .getByRole('button', { name: 'Route', exact: true });
}

function handles(page: Page) {
  return page.locator('[data-route-handle]');
}

function routeLine(page: Page) {
  return page.locator('.lc-route-line');
}

/** The route group lives in the Overlays popover; opens it on demand. */
async function routeButton(page: Page, name: string) {
  const button = page.getByRole('button', { name, exact: true });

  if (!(await button.isVisible())) {
    await page.getByRole('button', { name: 'Overlays', exact: true }).click();
  }

  return button;
}

async function startDrawing(page: Page, pointCount = 0): Promise<void> {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await loadLocation(page);
  await routeTool(page).click();

  for (const point of clickPoints.slice(0, pointCount)) {
    await page.mouse.click(point.x, point.y);
  }
}

async function center(page: Page, name: string): Promise<{ x: number; y: number }> {
  const box = await page.getByRole('button', { name, exact: true }).boundingBox();

  if (box === null) {
    throw new Error(`${name} is not laid out.`);
  }

  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test('Route is offered with real terrain on desktop and phone, not with generated terrain', async ({
  page,
}) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await expect(routeTool(page)).toHaveCount(0);
  await loadLocation(page);
  await expect(routeTool(page)).toBeVisible();
  await page.keyboard.press('r');
  await expect(routeTool(page)).toHaveAttribute('aria-pressed', 'true');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Route tool' })).toBeEnabled();
});

test('the phone Route button is disabled until real terrain loads', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${appUrl}?v=1&seed=123`);
  await expect(page.getByRole('button', { name: 'Route tool' })).toBeDisabled();
});

test('three taps place three handles joined by two insert targets', async ({ page }) => {
  await startDrawing(page, 3);
  await expect(handles(page)).toHaveCount(3);
  await expect(page.getByRole('button', { name: /^Insert waypoint after/ })).toHaveCount(2);
  await expect(routeLine(page)).toHaveAttribute('data-route-points', '3');
});

test('dragging the middle handle moves it', async ({ page }) => {
  await startDrawing(page, 3);
  const before = await center(page, 'Waypoint 2');

  await page.mouse.move(before.x, before.y);
  await page.mouse.down();
  await page.mouse.move(before.x + 40, before.y + 60, { steps: 5 });
  await page.mouse.up();

  await expect
    .poll(async () => (await center(page, 'Waypoint 2')).y)
    .toBeGreaterThan(before.y + 40);
  await expect(handles(page)).toHaveCount(3);
});

test('clicking a segment target inserts a waypoint after that point', async ({ page }) => {
  await startDrawing(page, 3);
  await page.getByRole('button', { name: 'Insert waypoint after 1', exact: true }).click();
  await expect(handles(page)).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Waypoint 2', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('Delete and the on-screen button remove the selected waypoint', async ({ page }) => {
  await startDrawing(page, 3);
  await page.getByRole('button', { name: 'Waypoint 2', exact: true }).click();
  await page.keyboard.press('Delete');
  await expect(handles(page)).toHaveCount(2);

  await page.getByRole('button', { name: 'Waypoint 1', exact: true }).click();
  await page.getByRole('button', { name: 'Delete waypoint', exact: true }).click();
  await expect(handles(page)).toHaveCount(1);
});

test('the Finish button ends drawing and keeps the route', async ({ page }) => {
  await startDrawing(page, 3);
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await expect(handles(page)).toHaveCount(0);
  await expect(routeLine(page)).toHaveAttribute('data-route-points', '3');
});

test('Enter ends drawing and keeps the route', async ({ page }) => {
  await startDrawing(page, 3);
  await page.keyboard.press('Enter');
  await expect(handles(page)).toHaveCount(0);
  await expect(routeLine(page)).toHaveAttribute('data-route-points', '3');
});

test('Edit brings the handles back on a finished route', async ({ page }) => {
  await startDrawing(page, 3);
  await page.keyboard.press('Enter');
  await (await routeButton(page, 'Edit route')).click();
  await expect(handles(page)).toHaveCount(3);
});

test('Escape stops drawing but keeps the route, and a second Escape leaves the tool', async ({
  page,
}) => {
  await startDrawing(page, 3);
  await page.keyboard.press('Escape');
  await expect(handles(page)).toHaveCount(0);
  await expect(routeLine(page)).toHaveAttribute('data-route-points', '3');
  await expect(routeTool(page)).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(routeTool(page)).toHaveAttribute('aria-pressed', 'false');
});

test('Reverse flips the waypoint order', async ({ page }) => {
  await startDrawing(page, 3);
  const firstBefore = await center(page, 'Waypoint 1');

  await (await routeButton(page, 'Reverse route')).click();
  const lastAfter = await center(page, 'Waypoint 3');

  expect(Math.abs(lastAfter.x - firstBefore.x)).toBeLessThan(2);
  expect(Math.abs(lastAfter.y - firstBefore.y)).toBeLessThan(2);
});

test('Clear removes the route', async ({ page }) => {
  await startDrawing(page, 3);
  await (await routeButton(page, 'Clear route')).click();
  await expect(routeLine(page)).toHaveCount(0);
  await expect(handles(page)).toHaveCount(0);
});

test('replacing a route asks first: cancel keeps it, confirm replaces it', async ({ page }) => {
  await startDrawing(page, 3);
  await page.keyboard.press('Enter');

  await (await routeButton(page, 'Draw route')).click();
  const dialog = page.getByRole('alertdialog', { name: 'Replace the current route?' });

  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(routeLine(page)).toHaveAttribute('data-route-points', '3');

  await (await routeButton(page, 'Draw route')).click();
  await dialog.getByRole('button', { name: 'Replace route', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(routeLine(page)).toHaveAttribute('data-route-points', '0');
});

test('a route with fewer than two points is labelled incomplete', async ({ page }) => {
  await startDrawing(page, 1);
  await expect(page.locator('.lc-callout-label')).toContainText('Incomplete route');
  await page.mouse.click(clickPoints[1].x, clickPoints[1].y);
  await expect(page.locator('.lc-callout-label')).toHaveCount(0);
});

test('Export GPX downloads the drawn waypoints as a GPX track', async ({ page }) => {
  await startDrawing(page, 3);
  const button = await routeButton(page, 'Export route GPX');
  const waiting = page.waitForEvent('download');

  await button.click();
  const download = await waiting;
  const xml = (await readDownload(download)).toString('utf8');

  expect(download.suggestedFilename()).toMatch(/\.gpx$/);
  expect(xml).toContain('<gpx');
  expect(xml.match(/<trkpt /g)).toHaveLength(3);
});
