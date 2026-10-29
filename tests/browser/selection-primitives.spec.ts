import { expect, test, type Locator, type Page } from '@playwright/test';
import { serveSpecimens, specimensUrl } from './specimens-fixture';

function specimen(page: Page, key: string): Locator {
  return page.locator(`[data-specimen="${key}"]`);
}

async function openSpecimens(page: Page, only: string): Promise<void> {
  await serveSpecimens(page);
  await page.goto(`${specimensUrl}specimens.html?only=${only}`);
  await page.evaluate(() => document.fonts.ready);
}

async function hasVisibleFocusRing(locator: Locator): Promise<boolean> {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);

    return style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0;
  });
}

test('Segmented arrow keys move selection and focus', async ({ page }) => {
  await openSpecimens(page, 'segmented');
  const group = specimen(page, 'segmented/three-options/medium').getByRole('group', {
    name: 'Display',
  });
  const buttons = group.getByRole('button');

  await buttons.first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(buttons.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(buttons.nth(1)).toBeFocused();
  await expect(buttons.first()).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('ArrowLeft');
  await expect(buttons.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(buttons.first()).toBeFocused();
});

test('Segmented keeps a single tab stop on the selected option', async ({ page }) => {
  await openSpecimens(page, 'segmented');
  const buttons = specimen(page, 'segmented/two-options/compact').getByRole('button');

  await expect(buttons.first()).toHaveAttribute('tabindex', '0');
  await expect(buttons.nth(1)).toHaveAttribute('tabindex', '-1');
});

test('ChoiceTiles arrow keys move focus through the grid and Space chooses', async ({ page }) => {
  await openSpecimens(page, 'choice-tiles');
  const tiles = specimen(page, 'choice-tiles/columns-5')
    .getByRole('group', { name: 'Choice' })
    .getByRole('button');

  await tiles.first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(tiles.nth(1)).toBeFocused();
  await expect(tiles.first()).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ArrowDown');
  await expect(tiles.nth(5)).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(tiles.nth(0)).toBeFocused();
  await page.keyboard.press('End');
  await expect(tiles.nth(5)).toBeFocused();
  await page.keyboard.press('Space');
  await expect(tiles.nth(5)).toHaveAttribute('aria-pressed', 'true');
});

test('Space toggles Switch and Checkbox', async ({ page }) => {
  await openSpecimens(page, 'switch');
  const switchControl = specimen(page, 'switch/off/default').getByRole('switch', {
    name: 'Lock seed',
  });

  await switchControl.focus();
  await page.keyboard.press('Space');
  await expect(switchControl).toBeChecked();
  await page.keyboard.press('Space');
  await expect(switchControl).not.toBeChecked();

  await page.goto(`${specimensUrl}specimens.html?only=checkbox`);
  const checkbox = specimen(page, 'checkbox/unchecked/default').getByRole('checkbox', {
    name: 'Terrain model',
  });

  await checkbox.focus();
  await page.keyboard.press('Space');
  await expect(checkbox).toBeChecked();
});

test('Select works with selectOption', async ({ page }) => {
  await openSpecimens(page, 'select');
  const article = specimen(page, 'select/ungrouped/default');

  await article.getByLabel('Format').selectOption('png');
  await expect(article.getByLabel('Format')).toHaveValue('png');
  await expect(article).toContainText('02/03');
});

const tabbableControls = [
  { only: 'segmented', key: 'segmented/two-options/medium', control: 'button', ring: 'button' },
  { only: 'switch', key: 'switch/off/default', control: 'input', ring: '.lc-switch__track' },
  {
    only: 'checkbox',
    key: 'checkbox/unchecked/default',
    control: 'input',
    ring: '.lc-checkbox__box',
  },
  { only: 'choice-tiles', key: 'choice-tiles/columns-3', control: 'button', ring: 'button' },
  { only: 'value-chip', key: 'value-chip/unselected/default', control: 'button', ring: 'button' },
  { only: 'select', key: 'select/ungrouped/default', control: 'select', ring: 'select' },
] as const;

for (const { only, key, control, ring } of tabbableControls) {
  test(`Tab reaches ${only} with a visible focus ring`, async ({ page }) => {
    await openSpecimens(page, only);
    const target = specimen(page, key).locator(control).first();
    const maximumTabPresses = 80;

    for (let press = 0; press < maximumTabPresses; press++) {
      await page.keyboard.press('Tab');

      if (await target.evaluate((element) => element === document.activeElement)) {
        break;
      }
    }

    await expect(target).toBeFocused();
    expect(await hasVisibleFocusRing(specimen(page, key).locator(ring).first())).toBe(true);
  });
}

test('forced colors leaves the native inputs operable', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await openSpecimens(page, 'switch');
  const switchControl = specimen(page, 'switch/off/default').getByRole('switch', {
    name: 'Lock seed',
  });

  await switchControl.check();
  await expect(switchControl).toBeChecked();
  expect(await switchControl.evaluate((element) => getComputedStyle(element).appearance)).toBe(
    'auto',
  );

  await page.goto(`${specimensUrl}specimens.html?only=checkbox`);
  const checkbox = specimen(page, 'checkbox/unchecked/default').getByRole('checkbox');

  await checkbox.check();
  await expect(checkbox).toBeChecked();
});
