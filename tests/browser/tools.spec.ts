import { expect, test, type Page } from '@playwright/test';
import { appUrl, enter3D, loadLocation, section, serveStudio } from './studio-fixture';

test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } });
// Software WebGL on CI runners is several times slower than local GPUs.
test.describe.configure({ timeout: 90_000 });
test.beforeEach(async ({ page }) => {
  await serveStudio(page);
});

const desktopWidthPx = 1280;
const realSpanMeters = 8_000;
const generatedSpanMeters = 10_000;

function tool(page: Page, name: 'Select' | 'Crop' | 'Measure') {
  return page.getByRole('group', { name: 'Tool' }).getByRole('button', { name, exact: true });
}

function cropSize(page: Page) {
  return page.getByRole('slider', { name: 'Crop size', exact: true });
}

async function drag(page: Page, from: Point, to: Point): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
}

interface Point {
  x: number;
  y: number;
}

async function center(page: Page, name: string): Promise<Point> {
  const box = await page.getByRole('slider', { name, exact: true }).boundingBox();

  if (box === null) {
    throw new Error(`${name} is not laid out.`);
  }

  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** The callout's distance in metres, e.g. `3.75 km` → 3750. */
async function measuredMeters(page: Page): Promise<number> {
  const text = (await page.locator('.lc-callout-label__value').textContent()) ?? '';
  const match = /^([\d.]+) (k?m)$/.exec(text);

  if (match === null) {
    throw new Error(`Expected a distance in the callout, got "${text}".`);
  }

  return Number(match[1]) * (match[2] === 'km' ? 1000 : 1);
}

test('crop mode frames the 3D model with eight handles and resizes the model crop', async ({
  page,
}) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await enter3D(page);
  await section(page, 'Model');
  await expect(cropSize(page)).toHaveValue('100');
  await tool(page, 'Crop').click();
  await expect(page.locator('[data-hud] .lc-crop-frame')).toBeVisible();
  await expect(page.locator('[data-hud]').getByRole('slider')).toHaveCount(8);
  const rightEdge = await center(page, 'Crop right edge');

  await drag(page, rightEdge, { x: rightEdge.x - 120, y: rightEdge.y });
  await expect(cropSize(page)).not.toHaveValue('100');
  const draggedSize = Number(await cropSize(page).inputValue());

  expect(draggedSize).toBeLessThan(90);
  await expect(page.getByRole('img', { name: /Terrain crop preview/ })).not.toHaveAttribute(
    'data-crop-center',
    '0.5,0.5',
  );
  await page.getByRole('slider', { name: 'Crop right edge', exact: true }).focus();
  await page.keyboard.press('Shift+ArrowLeft');
  await expect
    .poll(async () => Number(await cropSize(page).inputValue()))
    .toBeLessThan(draggedSize);
});

test('the crop widget and the crop frame stay in sync', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await enter3D(page);
  await section(page, 'Model');
  await tool(page, 'Crop').click();
  const rightEdge = page.getByRole('slider', { name: 'Crop right edge', exact: true });
  const fullValue = Number(await rightEdge.getAttribute('aria-valuenow'));

  await cropSize(page).fill('50');
  await expect
    .poll(async () => Number(await rightEdge.getAttribute('aria-valuenow')))
    .toBeLessThan(fullValue);
});

test('only an active tool takes canvas pointer events', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  const hitAt = (point: Point) =>
    page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.closest('#studio-viewport, [data-hud]')?.id,
      point,
    );

  await expect(tool(page, 'Select')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-hud] .lc-hud-layer__tools')).toBeEmpty();
  expect(await hitAt({ x: 400, y: 400 })).toBe('studio-viewport');
  await tool(page, 'Measure').click();
  expect(await hitAt({ x: 400, y: 400 })).not.toBe('studio-viewport');
});

test('measuring across real terrain matches its 8 km span and Escape clears', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await loadLocation(page);
  await page.keyboard.press('m');
  await expect(tool(page, 'Measure')).toHaveAttribute('aria-pressed', 'true');
  await drag(page, { x: 100, y: 400 }, { x: 700, y: 400 });
  const expectedMeters = (600 * realSpanMeters) / desktopWidthPx;

  expect(Math.abs((await measuredMeters(page)) - expectedMeters) / expectedMeters).toBeLessThan(
    0.02,
  );
  await expect(page.locator('.lc-callout-label')).toContainText('Bearing 090°');
  await page.keyboard.press('Escape');
  await expect(page.locator('.lc-measure-line')).toHaveCount(0);
  await expect(tool(page, 'Select')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Collapse controls' })).toBeVisible();
});

test('two taps measure procedural terrain on its nominal scale', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await tool(page, 'Measure').click();
  await page.mouse.click(500, 200);
  await expect(page.getByRole('button', { name: 'Measure start' })).toBeVisible();
  await page.mouse.click(500, 600);
  const expectedMeters = (400 * generatedSpanMeters) / desktopWidthPx;

  expect(Math.abs((await measuredMeters(page)) - expectedMeters)).toBeLessThan(10);
  await expect(page.locator('.lc-callout-label')).toContainText('Bearing 180°');
  const end = page.getByRole('button', { name: 'Measure end' });
  const endBox = await end.boundingBox();

  if (endBox === null) {
    throw new Error('Measure end is not laid out.');
  }

  const endPoint = { x: endBox.x + endBox.width / 2, y: endBox.y + endBox.height / 2 };

  await drag(page, endPoint, { x: endPoint.x, y: endPoint.y - 200 });
  expect(
    Math.abs((await measuredMeters(page)) - (200 * generatedSpanMeters) / desktopWidthPx),
  ).toBeLessThan(10);
});

test('C and M shortcuts toggle tools but never fire inside the place search', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await page.keyboard.press('c');
  await expect(tool(page, 'Select')).toHaveAttribute('aria-pressed', 'true');
  await enter3D(page);
  await expect(tool(page, 'Crop')).toBeVisible();
  await page.keyboard.press('c');
  await expect(tool(page, 'Crop')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('c');
  await expect(tool(page, 'Select')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Coordinates', exact: true }).click();
  const search = page.locator('.header-place-search').getByRole('combobox');

  await search.click();
  await search.pressSequentially('cm');
  await expect(search).toHaveValue('cm');
  await expect(tool(page, 'Select')).toHaveAttribute('aria-pressed', 'true');
});

test('the phone mode bar toggles the measure tool and drops the sheet to peek', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${appUrl}?v=1&seed=123`);
  const measure = page.getByRole('button', { name: 'Measure tool' });

  await expect(page.getByRole('button', { name: 'Crop tool' })).toBeDisabled();
  await measure.click();
  await expect(measure).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.lc-measure-line')).toHaveCount(1);
  await expect(page.locator('.studio-shell')).toHaveAttribute('data-sheet-snap', 'peek');
  await measure.click();
  await expect(measure).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.lc-measure-line')).toHaveCount(0);
});

const elevationLine = /^(Start|End) -?\d+ m$/;
const differenceLine = /^Δ (\+|-)?\d+ m$/;

async function calloutLines(page: Page): Promise<string[]> {
  return page.locator('.lc-callout-label__meta').allTextContents();
}

async function markerCentre(page: Page, name: 'Measure start' | 'Measure end'): Promise<Point> {
  const box = await page.getByRole('button', { name, exact: true }).boundingBox();

  if (box === null) {
    throw new Error(`${name} is not laid out.`);
  }

  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test('measuring real terrain in 2D shows distance, bearing, both elevations and the difference', async ({
  page,
}) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await loadLocation(page);
  await page.keyboard.press('m');
  await drag(page, { x: 100, y: 400 }, { x: 700, y: 400 });
  await expect(page.locator('.lc-callout-label')).toContainText('Bearing 090°');
  const lines = await calloutLines(page);

  expect(lines).toHaveLength(4);
  expect(lines[1]).toMatch(elevationLine);
  expect(lines[2]).toMatch(elevationLine);
  expect(lines[3]).toMatch(differenceLine);
  await expect(page.locator('.lc-measure-line__endpoint')).toHaveCount(2);
});

test('procedural measure shows no elevations', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await tool(page, 'Measure').click();
  await drag(page, { x: 300, y: 300 }, { x: 600, y: 300 });
  await expect(page.locator('.lc-callout-label')).toContainText('Bearing 090°');
  expect(await calloutLines(page)).toEqual(['Bearing 090°']);
});

test('3D measure endpoints stay on their terrain coordinates when the camera moves', async ({
  page,
}) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await loadLocation(page);
  await enter3D(page);
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  await page.keyboard.press('m');
  await page.mouse.click(560, 420);
  await page.mouse.click(720, 380);
  await expect(page.locator('.lc-callout-label')).toContainText('Start');
  const readout = await page.locator('.lc-callout-label').textContent();
  const startBefore = await markerCentre(page, 'Measure start');

  await page.getByRole('button', { name: 'Orbit', exact: true }).click();
  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  await page.getByRole('button', { name: 'Orbit', exact: true }).click();
  await expect
    .poll(async () => {
      const now = await markerCentre(page, 'Measure start');

      return Math.hypot(now.x - startBefore.x, now.y - startBefore.y);
    })
    .toBeGreaterThan(5);
  expect(await page.locator('.lc-callout-label').textContent()).toBe(readout);
});

test('route handles show in 3D', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await loadLocation(page);
  await enter3D(page);
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  await page.keyboard.press('r');
  await page.mouse.click(520, 420);
  await page.mouse.click(640, 340);
  await page.mouse.click(740, 430);
  await expect(page.locator('[data-route-handle]')).toHaveCount(3);
});
