import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { appUrl, loadLocation, serveStudio } from './studio-fixture';

test.use({ viewport: { width: 390, height: 844 } });
test.beforeEach(async ({ page }) => {
  await serveStudio(page);
});

const routeFile = resolve('tests/fixtures/route.gpx');
const pages = (page: Page) => page.getByRole('navigation', { name: 'Pages' });
const latitudeField = (page: Page) => page.getByLabel('Latitude', { exact: true });

test('reopening a saved design restores its location and route', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await loadLocation(page);
  await openSection(page, 'Terrain');
  const savedLatitude = await latitudeField(page).inputValue();

  await openSection(page, 'Route');
  await page.getByLabel('GPX file').setInputFiles(routeFile);
  await expect(page.locator('.lc-route-line')).toBeVisible();

  await pages(page).getByRole('button', { name: 'Library', exact: true }).click();
  await page.getByRole('button', { name: 'Save current' }).click();
  await expect(page.locator('.lc-model-card')).toHaveCount(1);

  // Move elsewhere and drop the route so only the saved copy can bring them back.
  await pages(page).getByRole('button', { name: 'Studio', exact: true }).click();
  await openSection(page, 'Route');
  await page.getByRole('button', { name: 'Clear route', exact: true }).click();
  await openSection(page, 'Terrain');
  await latitudeField(page).fill('10');
  await latitudeField(page).press('Tab');
  await page.getByRole('button', { name: 'Load terrain', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Load terrain', exact: true })).toBeEnabled();
  await expect(page.locator('.lc-route-line')).toHaveCount(0);

  await pages(page).getByRole('button', { name: 'Library', exact: true }).click();
  await page.locator('.lc-model-card').getByRole('button').first().click();

  await expect(page.locator('.lc-route-line')).toBeVisible();
  await openSection(page, 'Terrain');
  await expect(latitudeField(page)).toHaveValue(savedLatitude);
});

/** The phone sheet can sit over the section rail, so click through the DOM rather than by pointer. */
async function openSection(page: Page, name: string): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Editing section' })
    .getByRole('button', { name, exact: true })
    .dispatchEvent('click');
}
