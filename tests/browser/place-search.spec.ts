import { expect, test } from '@playwright/test';
import { appUrl, serveStudio } from './studio-fixture';

test('header search supports keyboard selection and escape', async ({ page }) => {
  await serveStudio(page);
  await page.route('https://photon.komoot.io/**', (route) =>
    route.fulfill({
      json: {
        features: [
          { geometry: { coordinates: [-5.0035, 56.7969] }, properties: { name: 'Ben Nevis' } },
          { geometry: { coordinates: [-4.076, 53.0685] }, properties: { name: 'Snowdon' } },
        ],
      },
    }),
  );
  await page.goto(`${appUrl}?v=1&seed=123`);
  await page.getByRole('button', { name: 'Coordinates', exact: true }).click();
  const search = page.locator('.header-place-search').getByRole('combobox');

  await expect(page.getByRole('combobox', { name: 'Search' })).toHaveCount(1);

  await search.fill('Ben');
  await expect(page.getByRole('option', { name: 'Snowdon' })).toBeVisible();
  await search.press('ArrowUp');
  await expect(page.getByRole('option', { name: 'Snowdon' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await search.press('Escape');
  await expect(search).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await search.fill('Snow');
  await expect(page.getByRole('option', { name: 'Snowdon' })).toBeVisible();
  await search.press('ArrowUp');
  await search.press('Enter');
  await expect(page.locator('#terrain-place')).toHaveValue('53.0685,-4.076');
});

test('mobile users can inspect terrain attribution', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await serveStudio(page);
  await page.goto(`${appUrl}?v=1&seed=123`);
  await page.getByRole('button', { name: 'Coordinates', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Real terrain loaded' })).toBeVisible();
  await page.getByText('Data sources', { exact: true }).click();
  await expect(page.locator('.mobile-attribution p')).toContainText('Copernicus');
  await expect(page.getByRole('combobox', { name: 'Search' })).toHaveCount(1);
});

test('search result span shortcuts load the selected place at that span', async ({ page }) => {
  await serveStudio(page);
  await page.route('https://photon.komoot.io/**', (route) =>
    route.fulfill({
      json: {
        features: [
          { geometry: { coordinates: [-5.0035, 56.7969] }, properties: { name: 'Ben Nevis' } },
        ],
      },
    }),
  );
  await page.goto(`${appUrl}?v=1&seed=123`);
  await page.getByRole('button', { name: 'Coordinates', exact: true }).click();
  const search = page.locator('.header-place-search').getByRole('combobox');

  await search.fill('Ben');
  const shortcut = page.getByRole('button', { name: 'Load Ben Nevis at 50 km' });

  await expect(shortcut).toBeVisible();
  const pointerDownAccepted = await shortcut.evaluate((button) =>
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })),
  );
  const mouseDownAccepted = await shortcut.evaluate((button) =>
    button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })),
  );

  expect(pointerDownAccepted).toBe(false);
  expect(mouseDownAccepted).toBe(false);
  await expect(search).toBeFocused();
  await shortcut.click();
  await expect(page.locator('#terrain-place')).toHaveValue('56.7969,-5.0035');
  await expect(search).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText('50 km', { exact: true }).first()).toBeVisible();
  await search.fill('Ben ');
  await expect(shortcut).toBeVisible();
  await search.press('Tab');
  await expect(page.getByRole('button', { name: 'Load Ben Nevis at 10 km' })).toBeFocused();
});
