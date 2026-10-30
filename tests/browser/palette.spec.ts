import { expect, test, type Page } from '@playwright/test';
import { appUrl, loadLocation, serveStudio } from './studio-fixture';

test.beforeEach(async ({ page }) => {
  await serveStudio(page);
});

function palette(page: Page) {
  return page.getByRole('dialog', { name: 'Command palette' });
}

function paletteInput(page: Page) {
  return palette(page).getByRole('combobox', { name: 'Find a command' });
}

test('Cmd+K opens the palette focused; Escape closes it and restores focus', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  const opener = page
    .getByRole('navigation', { name: 'Editing section' })
    .getByRole('button', { name: 'Terrain', exact: true });

  await opener.focus();
  await page.keyboard.press('ControlOrMeta+k');
  await expect(palette(page)).toBeVisible();
  await expect(paletteInput(page)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(palette(page)).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('a contour parameter is found by name, previewed and applied', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await loadLocation(page);
  await page.keyboard.press('ControlOrMeta+k');
  await paletteInput(page).fill('interval');
  const mode = palette(page).getByRole('option', { name: /Interval mode/ });

  await expect(mode).toContainText('CONT.01');
  await expect(mode).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await expect(
    palette(page).getByRole('textbox', { name: 'New value for Interval mode' }),
  ).toBeFocused();
  await page.keyboard.type('fixed');
  await expect(palette(page)).toContainText('→');
  await page.keyboard.press('Enter');
  await expect(palette(page)).toHaveCount(0);
  await expect(page.locator('#terrain-contour-mode')).toHaveValue('fixed');
  await expect(page.getByRole('region', { name: 'Contours settings' })).toBeVisible();

  await page.keyboard.press('ControlOrMeta+k');
  await paletteInput(page).fill('interval (m)');
  await page.keyboard.press('Enter');
  await page.keyboard.type('40');
  await page.keyboard.press('Enter');
  await expect(page.locator('#terrain-contour-interval')).toHaveValue('40');
});

test('a slider value set from the palette shows in the slider output', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await page.keyboard.press('ControlOrMeta+k');
  await paletteInput(page).fill('opacity');
  await expect(palette(page).getByRole('option', { name: /CONT\.02\s*Opacity/ })).toBeVisible();
  await page.keyboard.press('Enter');
  await page.keyboard.type('0.5');
  await page.keyboard.press('Enter');
  await expect(page.locator('output[for="strokeOpacity"]')).toHaveText('0.5');
  await expect(page.getByRole('region', { name: 'Contours settings' })).toBeVisible();
});

test('typing a place name lists searched locations', async ({ page }) => {
  await page.route('https://photon.komoot.io/**', (route) =>
    route.fulfill({
      json: {
        features: [
          { geometry: { coordinates: [-4.076, 53.0685] }, properties: { name: 'Snowdon' } },
        ],
      },
    }),
  );
  await page.goto(`${appUrl}?v=1&seed=123`);
  await page.keyboard.press('ControlOrMeta+k');
  await paletteInput(page).fill('Snowd');
  const location = palette(page).getByRole('option', { name: 'Snowdon', exact: true });

  await expect(location).toBeVisible();
  await expect(palette(page).getByRole('group', { name: 'Locations' })).toContainText('Snowdon');
  await location.click();
  await expect(palette(page)).toHaveCount(0);
  await expect(page.locator('#terrain-place')).toHaveValue('53.0685,-4.076');
});

test('Cmd+K inside a text field does nothing', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await loadLocation(page);
  await page.locator('.header-place-search').getByRole('combobox').focus();
  await page.keyboard.press('ControlOrMeta+k');
  await expect(palette(page)).toHaveCount(0);
});

test('phones open the palette from the map controls as a bottom sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${appUrl}?v=1&seed=123`);
  const opener = page.getByRole('button', { name: 'Command palette', exact: true });

  await opener.click();
  await expect(paletteInput(page)).toBeFocused();
  await expect(palette(page).locator('.lc-command-palette')).toHaveAttribute(
    'data-layout',
    'sheet',
  );
  const box = await palette(page).boundingBox();

  expect(box?.width).toBe(390);
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBe(844);
  await palette(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(palette(page)).toHaveCount(0);
  await expect(opener).toBeFocused();
});
