import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { appUrl, enter3D, loadLocation, section, serveStudio } from './studio-fixture';

test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } });
test.beforeEach(async ({ page }) => {
  await serveStudio(page);
});

const routeFile = resolve('tests/fixtures/route.gpx');

function profile(page: Page) {
  return page.getByRole('region', { name: 'Route profile' });
}

function chart(page: Page) {
  return page.getByRole('slider', { name: 'Inspect route profile' });
}

async function loadGpxRoute(page: Page): Promise<void> {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await loadLocation(page);
  await section(page, 'Route');
  await page.getByLabel('GPX file').setInputFiles(routeFile);
  await expect(page.locator('.lc-route-line')).toBeVisible();
}

async function box(page: Page, selector: string) {
  const found = await page.locator(selector).first().boundingBox();

  if (found === null) {
    throw new Error(`${selector} is not laid out.`);
  }

  return found;
}

test('the profile is absent without a route, opens with one and collapses without losing it (REQ-23)', async ({
  page,
}) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await loadLocation(page);
  await expect(profile(page)).toHaveCount(0);

  await loadGpxRoute(page);
  await expect(profile(page)).toHaveAttribute('data-route-profile', 'open');
  await expect(chart(page)).toBeVisible();

  await page.getByRole('button', { name: 'Collapse route profile' }).click();
  await expect(profile(page)).toHaveAttribute('data-route-profile', 'collapsed');
  await expect(chart(page)).toBeHidden();
  await expect(page.locator('.lc-route-line')).toBeVisible();

  await page.getByRole('button', { name: 'Expand route profile' }).click();
  await expect(chart(page)).toBeVisible();
});

test('on desktop the profile docks below the HUD and above the footer (REQ-24)', async ({
  page,
}) => {
  await loadGpxRoute(page);
  await expect(chart(page)).toBeVisible();

  const panel = await box(page, 'section[data-route-profile]');
  const frame = await box(page, '.lc-hud-layer__frame');
  const footer = await box(page, '.studio-footer');

  expect(panel.y).toBeGreaterThanOrEqual(frame.y + frame.height - 1);
  expect(panel.y + panel.height).toBeLessThanOrEqual(footer.y + 1);
});

test('on a phone the profile sits inside the bottom sheet (REQ-25)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loadGpxRoute(page);

  await expect(profile(page)).toHaveCount(1);
  await expect(page.locator('.lc-bottom-sheet [data-route-profile]')).toHaveCount(1);
});

test('keyboard and pointer inspection set the 2D and 3D highlights (REQ-26)', async ({ page }) => {
  await loadGpxRoute(page);
  await expect(page.locator('[data-route-cursor]')).toHaveCount(0);

  await chart(page).focus();
  await page.keyboard.press('End');
  await expect(chart(page)).toHaveAttribute('aria-valuetext', /km, /);
  await expect(page.locator('.lc-route-line [data-route-cursor]')).toHaveCount(1);

  await page.keyboard.press('Home');
  await expect(chart(page)).toHaveAttribute('aria-valuenow', '0');

  await chart(page).blur();
  await expect(page.locator('.lc-route-line [data-route-cursor]')).toHaveCount(0);

  const plot = await box(page, '.lc-route-profile__plot');

  await page.mouse.move(plot.x + plot.width / 2, plot.y + plot.height / 2);
  await expect(page.locator('.lc-route-line [data-route-cursor]')).toHaveCount(1);
  await page.mouse.move(plot.x + plot.width / 2, plot.y - 120);
  await expect(page.locator('.lc-route-line [data-route-cursor]')).toHaveCount(0);

  await enter3D(page);
  await chart(page).focus();
  await page.keyboard.press('PageUp');
  await expect(page.locator('canvas.terrain-3d')).toHaveAttribute('data-route-marker', 'visible');
});

test('the steep threshold defaults to 15% and rejects values outside 1 to 100 (REQ-27, 28)', async ({
  page,
}) => {
  await loadGpxRoute(page);

  const threshold = page.getByLabel('Steep threshold');

  await expect(threshold).toHaveValue('15');
  await threshold.fill('101');
  await threshold.press('Enter');
  await expect(page.getByRole('alert').filter({ hasText: 'from 1 to 100' })).toBeVisible();

  await threshold.fill('30');
  await threshold.press('Enter');
  await expect(threshold).toHaveValue('30');
  await expect(page.getByRole('alert').filter({ hasText: 'from 1 to 100' })).toHaveCount(0);
});

test('an imported GPX is labelled terrain-derived and reverse swaps ascent and descent (REQ-30, 33)', async ({
  page,
}) => {
  await loadGpxRoute(page);
  await expect(profile(page)).toContainText('Terrain-derived');

  const ascent = profile(page).locator('.lc-route-profile__figure', { hasText: 'Ascent' });
  const descent = profile(page).locator('.lc-route-profile__figure', { hasText: 'Descent' });
  const before = { ascent: await ascent.innerText(), descent: await descent.innerText() };

  await section(page, 'Route');
  await page.getByRole('button', { name: 'Reverse route', exact: true }).click();

  await expect(ascent).toContainText(before.descent.replace('Descent', '').trim());
  await expect(descent).toContainText(before.ascent.replace('Ascent', '').trim());
});
