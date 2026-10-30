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

test('the mobile layout snaps its real sheet and hides map controls when full', async ({
  page,
}) => {
  await openSystemMode(page);
  await partsNav(page).getByRole('button', { name: 'Layouts' }).click();
  await partsNav(page)
    .getByRole('button', { name: /Mobile studio/ })
    .click();

  const phone = page.locator('.system-mobile-shell');

  await phone.getByRole('button', { name: 'Full' }).click();
  await expect(phone.locator('[data-sheet-snap="full"]')).toBeVisible();
  await expect(phone.locator('.system-mobile-shell__controls')).toHaveCSS('opacity', '0');
});

test('a deep link by code opens straight onto that part and settles the URL on its id', async ({
  page,
}) => {
  await page.goto(`${appUrl}?mode=system&part=prim.08`);
  await expect(page.getByRole('heading', { level: 1, name: 'Ruler slider' })).toBeVisible();
  await expect(page).toHaveURL(/[?&]mode=system&part=ruler-slider(&|$)/);
  await expect(currentPart(page), 'a cold load leaves focus alone').not.toBeFocused();

  await page.keyboard.press('ArrowDown');
  await expect(page).toHaveURL(/part=select/);
});

test('leaving system mode drops the link and keeps the design parameters', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123&mode=system&part=tag`);
  await expect(page.getByRole('heading', { level: 1, name: 'Tag' })).toBeVisible();

  await page.getByRole('button', { name: '← Back to studio' }).click();
  await expect(page.getByRole('heading', { name: 'LANDCU.BE Studio' })).toBeVisible();
  await expect(page).not.toHaveURL(/mode=|part=/);
  await expect(page).toHaveURL(/seed=123/);
});

test('Cmd+F and slash focus Find', async ({ page }) => {
  await openSystemMode(page);
  const find = page.getByRole('searchbox');

  await page.keyboard.press('ControlOrMeta+f');
  await expect(find).toBeFocused();
  await find.press('Escape');
  await currentPart(page).focus();
  await page.keyboard.press('/');
  await expect(find).toBeFocused();
  await expect(find).toHaveValue('');
});

test('a deep link on a phone opens the studio and clears the link', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${appUrl}?v=1&seed=123&mode=system&part=tag`);
  await expect(page.getByRole('complementary', { name: 'Landscape controls' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Design system parts' })).toHaveCount(0);
  await expect(page).not.toHaveURL(/mode=system/);
});

test('a plate keeps its value after browsing away and back', async ({ page }) => {
  await page.goto(`${appUrl}?mode=system&part=ruler-slider`);
  const slider = page
    .getByRole('region', { name: 'Ruler slider specimens' })
    .getByRole('slider')
    .first();

  await slider.focus();
  await page.keyboard.press('End');
  const moved = await slider.inputValue();

  await currentPart(page).focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('heading', { level: 1, name: 'Select' })).toBeVisible();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('heading', { level: 1, name: 'Ruler slider' })).toBeVisible();
  await expect(slider).toHaveValue(moved);
});

test('studio and system state both survive a round trip', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await page.getByRole('button', { name: 'Coordinates' }).click();
  const placeSearch = page.getByRole('combobox', { name: /Search/ });

  await placeSearch.fill('Ben Nevis');
  await page.getByRole('button', { name: 'Design system ◧' }).click();
  await page.getByRole('searchbox').fill('glass');
  await page.getByRole('searchbox').blur();
  await page.keyboard.press('Escape');
  await expect(placeSearch).toHaveValue('Ben Nevis');

  await page.getByRole('button', { name: 'Design system ◧' }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('glass');
});

test('the rail shows no section pressed while Find lists results', async ({ page }) => {
  await openSystemMode(page);
  const rail = partsNav(page).getByRole('navigation', { name: 'Design system section' });

  await expect(rail.locator('[aria-pressed="true"]')).toHaveCount(1);
  await page.getByRole('searchbox').fill('glass');
  await expect(rail.locator('[aria-pressed="true"]')).toHaveCount(0);
});

test('a curated part says how many of its specimens it shows', async ({ page }) => {
  await page.goto(`${appUrl}?mode=system&part=button`);
  await expect(page.getByText('08 of 33 plates')).toBeVisible();
});
