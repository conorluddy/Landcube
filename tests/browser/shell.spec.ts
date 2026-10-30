import { expect, test, type Page } from '@playwright/test';
import { appUrl, openDefaultStudio, section, serveStudio } from './studio-fixture';

test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } });
test.beforeEach(async ({ page }) => {
  await serveStudio(page);
});

function rail(page: Page) {
  return page.getByRole('navigation', { name: 'Editing section' });
}

test('the studio is branded LANDCU.BE Studio', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await expect(page.getByRole('heading', { name: 'LANDCU.BE Studio' })).toBeVisible();
});

test('header, footer, inspector and dialogs are marked as UI surfaces', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);

  for (const surface of [
    page.locator('header'),
    page.locator('footer'),
    page.getByRole('complementary', { name: 'Landscape controls' }),
  ]) {
    await expect(surface).toHaveAttribute('data-ui-surface');
  }

  await page.getByRole('button', { name: 'Export ↗' }).click();
  await expect(page.getByRole('dialog', { name: 'Export' })).toHaveAttribute('data-ui-surface');
});

test('arrow keys move focus along the section rail', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  const terrain = rail(page).getByRole('button', { name: 'Terrain', exact: true });

  await terrain.focus();
  await page.keyboard.press('ArrowDown');
  await expect(rail(page).getByRole('button', { name: 'Contours', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await expect(rail(page).getByRole('button', { name: 'Overlays', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(terrain).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Overlays settings' })).toBeVisible();
});

test('the phone tab strip moves focus with left and right arrows', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${appUrl}?v=1&seed=123`);
  await rail(page).getByRole('button', { name: 'Terrain', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(rail(page).getByRole('button', { name: 'Contours', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(rail(page).getByRole('button', { name: 'Terrain', exact: true })).toBeFocused();
});

test('a collapsed inspector keeps its rail operable', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await page.getByRole('button', { name: 'Collapse controls' }).click();
  await expect(page.getByRole('region', { name: 'Terrain settings' })).toBeHidden();
  await rail(page).getByRole('button', { name: 'Colour', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Colour settings' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Collapse controls' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
});

test('the cursor deforms terrain over the viewport but not over UI surfaces', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  const terrain = page.locator('#terrain');
  const settled = await terrain.innerHTML();
  const brand = await page.getByRole('heading', { name: 'LANDCU.BE Studio' }).boundingBox();
  const inspector = await page
    .getByRole('complementary', { name: 'Landscape controls' })
    .boundingBox();

  if (brand === null || inspector === null) {
    throw new Error('Header brand or inspector is not laid out.');
  }

  // Single moves: stepping between surfaces would cross the open viewport.
  for (const point of [
    { x: brand.x + 10, y: brand.y + 10 },
    { x: inspector.x + 150, y: inspector.y + 300 },
  ]) {
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(400);
    expect(await terrain.innerHTML()).toBe(settled);
  }

  await page.mouse.move(400, 400, { steps: 5 });
  await expect.poll(() => terrain.innerHTML()).not.toBe(settled);
});

test('glass keeps its blur while the turntable rotates by default', async ({ page }) => {
  await openDefaultStudio(page);
  const shell = page.locator('.studio-shell');

  await expect(shell).not.toHaveAttribute('data-motion', 'active');
  await section(page, 'Orbit');
  await page.getByRole('switch', { name: 'Auto-rotate' }).check();
  await expect(shell).not.toHaveAttribute('data-motion', 'active');
  await expect(page.locator('header .lc-bar-group').first()).toHaveCSS('backdrop-filter', /blur\(/);
  await page.getByRole('switch', { name: 'Auto-rotate' }).uncheck();
  await expect(shell).not.toHaveAttribute('data-motion', 'active');
});
