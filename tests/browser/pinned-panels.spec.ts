import { expect, test, type Locator, type Page } from '@playwright/test';
import { appUrl, openDefaultStudio, section, serveStudio } from './studio-fixture';

test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } });
test.beforeEach(async ({ page }) => {
  await serveStudio(page);
});

async function pin(page: Page, sectionName: string, groupTitle: string): Promise<Locator> {
  await section(page, sectionName);
  await page.getByRole('button', { name: `Pin ${groupTitle}`, exact: true }).click();

  const panel = page.getByRole('dialog', { name: `${groupTitle} (pinned)` });

  await expect(panel).toBeVisible();

  return panel;
}

async function readPosition(panel: Locator): Promise<{ x: number; y: number }> {
  return panel.evaluate((element) => ({
    x: Number.parseFloat((element as HTMLElement).style.left),
    y: Number.parseFloat((element as HTMLElement).style.top),
  }));
}

test('pinning a group floats it and leaves a placeholder in the inspector', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  const panel = await pin(page, 'Contours', 'Contour density');
  const inspector = page.getByRole('region', { name: 'Contours settings' });

  await expect(inspector.getByText('Pinned: Contour density')).toBeVisible();
  await expect(page.locator('output[for="contourCount"]')).toHaveCount(1);
  await expect(panel.locator('output[for="contourCount"]')).toHaveCount(1);
  await expect(panel.getByRole('group', { name: 'Move Contour density' })).toBeFocused();
  await expect(panel).toHaveAttribute('data-ui-surface');

  await inspector.getByRole('button', { name: 'Dock', exact: true }).click();
  await expect(panel).toBeHidden();
  await expect(inspector.locator('output[for="contourCount"]')).toHaveCount(1);
});

test('dragging the header snaps the panel to the 12px grid', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  const panel = await pin(page, 'Contours', 'Contour density');
  const handle = panel.getByRole('group', { name: 'Move Contour density' });
  const start = await readPosition(panel);
  const box = await handle.boundingBox();

  if (box === null) {
    throw new Error('Drag handle is not laid out.');
  }

  await page.mouse.move(box.x + 40, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 140, box.y + 110, { steps: 5 });
  await page.mouse.up();

  const end = await readPosition(panel);

  expect(end.x % 12).toBe(0);
  expect(end.y % 12).toBe(0);
  expect(Math.abs(end.x - start.x - 100)).toBeLessThanOrEqual(6);
  expect(Math.abs(end.y - start.y - 100)).toBeLessThanOrEqual(6);
});

test('arrow keys move the focused header and Escape docks', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  const panel = await pin(page, 'Contours', 'Contour density');
  const start = await readPosition(panel);

  await page.keyboard.press('ArrowRight');
  expect(await readPosition(panel)).toEqual({ x: start.x + 12, y: start.y });
  await page.keyboard.press('Shift+ArrowDown');
  expect(await readPosition(panel)).toEqual({ x: start.x + 12, y: start.y + 48 });

  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(
    page.getByRole('region', { name: 'Contours settings' }).locator('output[for="contourCount"]'),
  ).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Contours settings' })).toBeVisible();
});

test('clicking a lower panel raises it above the others', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  const density = await pin(page, 'Contours', 'Contour density');
  const appearance = await pin(page, 'Contours', 'Contour appearance');
  const zIndex = (panel: Locator) =>
    panel.evaluate((element) => Number((element as HTMLElement).style.zIndex));

  expect(await zIndex(appearance)).toBeGreaterThan(await zIndex(density));
  // The cascade leaves the lower panel's top-left corner uncovered.
  await density
    .getByRole('group', { name: 'Move Contour density' })
    .click({ position: { x: 8, y: 8 } });
  await expect.poll(() => zIndex(density)).toBeGreaterThan(await zIndex(appearance));
});

test('the cursor does not deform terrain over a pinned panel', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  const panel = await pin(page, 'Contours', 'Contour density');
  const terrain = page.locator('#terrain');
  const settled = await terrain.innerHTML();
  const box = await panel.boundingBox();

  if (box === null) {
    throw new Error('Pinned panel is not laid out.');
  }

  await page.mouse.move(box.x + 100, box.y + 60);
  await page.waitForTimeout(400);
  expect(await terrain.innerHTML()).toBe(settled);
});

test('switching to 2D docks a pinned 3D-only group', async ({ page }) => {
  await openDefaultStudio(page);
  const panel = await pin(page, 'Contours', '3D contours');

  await page.getByRole('button', { name: '2D', exact: true }).click();
  await expect(panel).toBeHidden();
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await section(page, 'Contours');
  await expect(page.getByRole('button', { name: 'Pin 3D contours', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: '3D contours (pinned)' })).toHaveCount(0);
});

test('pinned panels do not survive a reload', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await pin(page, 'Contours', 'Contour density');
  await page.reload();
  await expect(page.locator('#terrain')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Contour density (pinned)' })).toHaveCount(0);
});

test('phones show no pin buttons', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${appUrl}?v=1&seed=123`);
  await expect(page.locator('#terrain')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Pin / })).toHaveCount(0);
});

test('panels stay clear of the inspector after the window shrinks', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  const panel = await pin(page, 'Contours', 'Contour density');

  for (let step = 0; step < 20; step += 1) {
    await page.keyboard.press('Shift+ArrowRight');
  }

  await page.setViewportSize({ width: 900, height: 720 });
  await expect
    .poll(async () => {
      const box = await panel.boundingBox();

      return box === null ? Number.POSITIVE_INFINITY : box.x + box.width;
    })
    .toBeLessThanOrEqual(900 - 408 - 12);
});
