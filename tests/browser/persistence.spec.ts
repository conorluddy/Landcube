import { expect, test } from '@playwright/test';
import { appUrl, openDefaultStudio, section, serveStudio } from './studio-fixture';

test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } });
test.beforeEach(async ({ page }) => {
  await serveStudio(page);
});

test('a fresh visit restores the last 3D look and design style', async ({ page }) => {
  await openDefaultStudio(page);
  await section(page, 'Colour');
  await page.getByLabel('Land finish').selectOption('satin');
  await page.getByRole('button', { name: 'Paper', exact: true }).click();

  await openDefaultStudio(page);
  await section(page, 'Colour');
  await expect(page.getByLabel('Land finish')).toHaveValue('satin');
  await expect(page.getByRole('button', { name: 'Paper', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('a design link opens with its own style, not the stored one', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await section(page, 'Colour');
  await page.getByRole('button', { name: 'Paper', exact: true }).click();

  await page.goto(`${appUrl}?v=1&seed=123`);
  await section(page, 'Colour');
  await expect(page.getByRole('button', { name: 'Charcoal', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
