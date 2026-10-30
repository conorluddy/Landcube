import { expect, test, type Page } from '@playwright/test';
import { appUrl, serveStudio } from './studio-fixture';

test.beforeEach(async ({ page }) => {
  await serveStudio(page);
});

function partsNav(page: Page) {
  return page.getByRole('complementary', { name: 'Design system parts' });
}

function currentPart(page: Page) {
  return partsNav(page).locator('.lc-part-row[aria-current="true"]');
}

async function openSystemMode(page: Page): Promise<void> {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await page.getByRole('button', { name: 'Design system ◧' }).click();
  await expect(page.getByRole('heading', { name: 'LANDCU.BE System · Rev A' })).toBeVisible();
}

test('the footer link flips into system mode, arrows browse, and Esc flips back', async ({
  page,
}) => {
  await openSystemMode(page);
  await expect(currentPart(page)).toContainText('Ink ramp');
  await expect(currentPart(page)).toBeFocused();
  await expect(
    partsNav(page).getByRole('navigation', { name: 'Design system section' }),
  ).toContainText('FNDN');

  await page.keyboard.press('ArrowDown');
  await expect(currentPart(page)).toContainText('Text roles');
  await expect(page.getByRole('heading', { level: 1, name: 'Text roles' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'LANDCU.BE Studio' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Design system ◧' })).toBeFocused();
  await expect(page.getByRole('complementary', { name: 'Landscape controls' })).toBeVisible();
});

test('modified arrows are left to the browser', async ({ page }) => {
  await openSystemMode(page);
  await page.keyboard.press('Alt+ArrowRight');
  await page.keyboard.press('Shift+ArrowDown');
  await expect(currentPart(page)).toContainText('Ink ramp');
});

test('arrow keys on a specimen slider move the slider, not the part', async ({ page }) => {
  await openSystemMode(page);
  await page.getByRole('searchbox').fill('ruler');
  await partsNav(page)
    .getByRole('button', { name: /Ruler slider/ })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Ruler slider' })).toBeVisible();

  const slider = page
    .getByRole('region', { name: 'Ruler slider specimens' })
    .getByRole('slider')
    .first();
  const before = await slider.inputValue();

  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await expect(slider).not.toHaveValue(before);
  await expect(currentPart(page)).toContainText('Ruler slider');
});

test('Esc in Find clears the query first, then leaves system mode', async ({ page }) => {
  await openSystemMode(page);
  const find = page.getByRole('searchbox');

  await find.fill('glass');
  await expect(partsNav(page)).toContainText('Results');
  await find.press('Escape');
  await expect(find).toHaveValue('');
  await expect(page.getByRole('heading', { name: 'LANDCU.BE System · Rev A' })).toBeVisible();

  await find.press('Escape');
  await expect(page.getByRole('heading', { name: 'LANDCU.BE Studio' })).toBeVisible();
});

test('a system chunk that fails to load returns to the studio with a message', async ({ page }) => {
  await page.route('**/assets/system-mode-*.js', (route) => route.abort());
  await page.goto(`${appUrl}?v=1&seed=123`);
  await page.getByRole('button', { name: 'Design system ◧' }).click();

  await expect(page.getByRole('status').filter({ hasText: 'could not load' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'LANDCU.BE Studio' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Landscape controls' })).toBeVisible();
});
