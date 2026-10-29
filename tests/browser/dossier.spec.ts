import { expect, test, type Page } from '@playwright/test';
import { appUrl, openDefaultStudio, serveStudio } from './studio-fixture';

test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } });
test.beforeEach(async ({ page }) => {
  await serveStudio(page);
});

async function openDossier(page: Page) {
  await page.getByRole('button', { name: 'Export ↗' }).click();
  await page.getByRole('button', { name: 'Model dossier', exact: true }).click();

  return page.getByRole('dialog', { name: 'Model dossier' });
}

test('the export sheet opens a dossier titled by seed, with Print, and Escape closes it', async ({
  page,
}) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  const dialog = await openDossier(page);

  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Seed 123' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Print', exact: true })).toBeVisible();
  await expect(dialog.locator('.lc-dossier__link')).toContainText('seed=123');
  await expect(dialog.getByLabel('Attribution')).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('real terrain prints its attribution in the dossier', async ({ page }) => {
  await openDefaultStudio(page);
  const footerAttribution = await page.locator('footer .attribution').first().textContent();
  const dialog = await openDossier(page);

  expect(footerAttribution).toBeTruthy();
  await expect(dialog.getByLabel('Attribution')).toContainText(footerAttribution ?? '');
});

test('print media shows only an A4-proportioned dossier sheet', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  const dialog = await openDossier(page);
  const sheet = dialog.locator('.lc-dossier');
  const screenBox = await sheet.boundingBox();

  expect(screenBox).not.toBeNull();
  expect((screenBox?.height ?? 0) / (screenBox?.width ?? 1)).toBeCloseTo(297 / 210, 1);

  await page.emulateMedia({ media: 'print' });
  await expect(sheet).toBeVisible();
  await expect(page.getByRole('complementary')).toBeHidden();
  await expect(page.locator('header').first()).toBeHidden();
  await expect(page.locator('footer').first()).toBeHidden();
  await expect(dialog.getByRole('button', { name: 'Print' })).toBeHidden();
  await expect(sheet.getByRole('button', { name: 'Copy' })).toBeHidden();
  await expect(page.locator('.lc-dossier-toolbar')).toBeHidden();
});

test('the dossier prints on one A4 page', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'page.pdf() is Chromium only.');
  await page.goto(`${appUrl}?v=1&seed=123`);
  await openDossier(page);
  const pdf = await page.pdf({
    format: 'A4',
    margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' },
  });
  const pageCount = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;

  expect(pageCount).toBe(1);
});
