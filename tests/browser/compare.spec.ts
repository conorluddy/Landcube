import { expect, test, type Page } from '@playwright/test';
import { appUrl, enter3D, serveStudio } from './studio-fixture';

test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } });
test.beforeEach(async ({ page }) => {
  await serveStudio(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${appUrl}?v=1&seed=123`);
  await expect(page.getByRole('button', { name: 'Compare presets' })).toBeVisible();
});

const paperBackground = '#eee9dd';

function strip(page: Page) {
  return page.getByRole('region', { name: 'Preset comparison' });
}

async function openStrip(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Compare presets' }).click();
  await expect(strip(page)).toBeVisible();
}

async function startPaperCompare(page: Page): Promise<void> {
  await openStrip(page);
  await strip(page).getByRole('button', { name: 'Paper', exact: true }).click();
  await expect(page.locator('[data-wipe]')).toBeVisible();
}

function divider(page: Page) {
  return page.getByRole('slider', { name: 'Compare divider' });
}

function sideBClip(page: Page): Promise<string> {
  return page
    .locator('[data-wipe-side-b]')
    .evaluate((element) => getComputedStyle(element).clipPath);
}

test('the footer toggle shows and hides the preset strip', async ({ page }) => {
  const toggle = page.getByRole('button', { name: 'Compare presets' });

  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(strip(page)).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(strip(page).getByRole('button')).toHaveCount(4);
  await toggle.click();
  await expect(strip(page)).toHaveCount(0);
});

test('picking a preset shows the wipe with A and B tags', async ({ page }) => {
  await startPaperCompare(page);
  await expect(page.locator('[data-wipe] [data-side="a"]')).toHaveText('A');
  await expect(page.locator('[data-wipe] [data-side="b"]')).toHaveText('B');
  await expect(divider(page)).toHaveAttribute('aria-valuenow', '50');
  await expect(page.locator('[data-wipe-side-b] svg')).toHaveCount(1);
});

test('hovering a card previews it as side B before any compare starts', async ({ page }) => {
  await openStrip(page);
  await expect(page.locator('[data-wipe]')).toHaveCount(0);
  await strip(page).getByRole('button', { name: 'Blueprint', exact: true }).hover();
  await expect(page.locator('[data-wipe]')).toBeVisible();
  await expect(divider(page)).toHaveCount(0);
  await page.mouse.move(600, 300);
  await expect(page.locator('[data-wipe]')).toHaveCount(0);
});

test('dragging the divider moves the clip', async ({ page }) => {
  await startPaperCompare(page);
  const clipBefore = await sideBClip(page);
  const handle = await divider(page).boundingBox();

  if (handle === null) {
    throw new Error('The divider handle has no box');
  }

  const handleY = handle.y + handle.height / 2;

  await page.mouse.move(handle.x + handle.width / 2, handleY);
  await page.mouse.down();
  await page.mouse.move(250, handleY, { steps: 6 });
  await page.mouse.up();

  const now = Number(await divider(page).getAttribute('aria-valuenow'));

  expect(now).toBeGreaterThanOrEqual(18);
  expect(now).toBeLessThanOrEqual(21);
  expect(await sideBClip(page)).not.toBe(clipBefore);
});

test('arrow keys move the divider by 2 percent and Shift by 10', async ({ page }) => {
  await startPaperCompare(page);
  await divider(page).focus();
  await page.keyboard.press('ArrowRight');
  await expect(divider(page)).toHaveAttribute('aria-valuenow', '52');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(divider(page)).toHaveAttribute('aria-valuenow', '48');
  await page.keyboard.press('Shift+ArrowRight');
  await expect(divider(page)).toHaveAttribute('aria-valuenow', '58');
  await page.keyboard.press('End');
  await expect(divider(page)).toHaveAttribute('aria-valuenow', '100');
});

test('comparison actions keep preset cards stationary when shown and dismissed', async ({
  page,
}) => {
  await openStrip(page);
  const paper = strip(page).getByRole('button', { name: 'Paper', exact: true });
  const initialBounds = await paper.boundingBox();

  await paper.click();
  await expect(strip(page).getByRole('button', { name: 'Cancel' })).toBeVisible();
  expect(await paper.boundingBox()).toEqual(initialBounds);
  await strip(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('[data-wipe]')).toHaveCount(0);
  expect(await paper.boundingBox()).toEqual(initialBounds);
});

test('Apply commits the preset and removes the wipe', async ({ page }) => {
  await startPaperCompare(page);
  await strip(page).getByRole('button', { name: 'Apply' }).click();
  await expect(page.locator('[data-wipe]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Colour', exact: true }).first().click();
  await expect(page.getByLabel('Canvas color')).toHaveValue(paperBackground);
});

test('Cancel and Escape restore the original design', async ({ page }) => {
  await page.getByRole('button', { name: 'Colour', exact: true }).first().click();
  const original = await page.getByLabel('Canvas color').inputValue();

  await startPaperCompare(page);
  await strip(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('[data-wipe]')).toHaveCount(0);
  await expect(page.getByLabel('Canvas color')).toHaveValue(original);

  await strip(page).getByRole('button', { name: 'Paper', exact: true }).click();
  await expect(page.locator('[data-wipe]')).toBeVisible();
  await page.mouse.move(600, 300);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-wipe]')).toHaveCount(0);
  await expect(page.getByLabel('Canvas color')).toHaveValue(original);
});

test('in 3D the strip stays, the wipe is hidden and a hint explains', async ({ page }) => {
  await openStrip(page);
  await enter3D(page);
  await expect(strip(page).getByText('A/B compare is 2D only')).toBeVisible();
  await strip(page).getByRole('button', { name: 'Paper', exact: true }).click();
  await expect(page.locator('[data-wipe]')).toHaveCount(0);
});

test('phones have no compare toggle', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Compare presets' })).toHaveCount(0);
});
