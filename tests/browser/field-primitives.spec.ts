import { expect, test, type Locator, type Page } from '@playwright/test';
import { serveSpecimens, specimensUrl } from './specimens-fixture';

async function openSpecimen(page: Page, component: string, specimen: string): Promise<Locator> {
  await serveSpecimens(page);
  await page.goto(`${specimensUrl}specimens.html?only=${component}`);

  const article = page.locator(`[data-specimen="${specimen}"]`);

  await article.waitFor();

  return article;
}

/** Tabs through the page until `target` has focus, proving it sits in the keyboard order. */
async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let presses = 0; presses < 12; presses++) {
    await page.keyboard.press('Tab');

    if (await target.evaluate((element) => element === document.activeElement)) {
      return;
    }
  }

  throw new Error('Tab never reached the target input.');
}

test('ArrowRight on the ruler slider updates the output text and fraction', async ({ page }) => {
  const specimen = await openSpecimen(page, 'ruler-slider', 'ruler-slider/default');
  const slider = specimen.getByRole('slider', { name: 'Line weight' });
  const output = specimen.locator('output');
  const root = specimen.locator('.lc-ruler-slider');

  await expect(output).toHaveText('40');
  await expect(root).toHaveCSS('--lc-slider-fraction', '0.4');

  await slider.focus();
  await page.keyboard.press('ArrowRight');

  await expect(output).toHaveText('41');
  await expect(root).toHaveCSS('--lc-slider-fraction', '0.41');
});

test('ruler slider shows a focus ring on its track and keeps its unit in the output text', async ({
  page,
}) => {
  const specimen = await openSpecimen(page, 'ruler-slider', 'ruler-slider/unit');

  await expect(specimen.locator('output')).toHaveText('12 s');

  await specimen.getByRole('slider').focus();
  await page.keyboard.press('ArrowRight');
  await expect(specimen.locator('.lc-ruler-slider__track')).toHaveCSS('outline-style', 'solid');
});

test('Tab reaches the number, text and colour inputs with a visible focus indicator', async ({
  page,
}) => {
  const number = await openSpecimen(page, 'number-field', 'number-field/default');

  await tabTo(page, number.getByLabel('Width'));
  await expect(number.getByLabel('Width')).toHaveCSS('border-top-color', 'rgb(242, 242, 240)');

  const text = await openSpecimen(page, 'text-field', 'text-field/default');

  await tabTo(page, text.getByLabel('Plaque text'));
  await expect(text.getByLabel('Plaque text')).toHaveCSS('border-top-color', 'rgb(242, 242, 240)');

  const color = await openSpecimen(page, 'color-field', 'color-field/default');

  await tabTo(page, color.getByLabel('Canvas color'));
  await expect(color.locator('.lc-color-field__swatch')).toHaveCSS('outline-style', 'solid');
});

test('typing in a number field commits on blur and flags an invalid draft', async ({ page }) => {
  const specimen = await openSpecimen(page, 'number-field', 'number-field/default');
  const input = specimen.getByLabel('Width');

  await input.fill('480');
  await input.blur();
  await expect(input).toHaveValue('480');
  await expect(input).not.toHaveAttribute('aria-invalid', 'true');

  await input.fill('1');
  await input.blur();
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(specimen.getByRole('alert')).toBeVisible();

  await input.fill('600');
  await expect(input).not.toHaveAttribute('aria-invalid', 'true');
});

test('an empty optional number field shows the dash placeholder', async ({ page }) => {
  const specimen = await openSpecimen(page, 'number-field', 'number-field/empty');

  await expect(specimen.getByLabel('Width')).toHaveAttribute('placeholder', '—');
});

test('field pair stacks when its container is under 240px', async ({ page }) => {
  await serveSpecimens(page);
  await page.goto(`${specimensUrl}specimens.html?only=field-pair`);
  const columnCount = (key: string): Promise<number> =>
    page
      .locator(`[data-specimen="field-pair/${key}"] .lc-field-pair__grid`)
      .evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length);

  expect(await columnCount('default')).toBe(2);
  expect(await columnCount('default/at-threshold')).toBe(2);
  expect(await columnCount('default/just-under')).toBe(1);
  expect(await columnCount('default/narrow')).toBe(1);
});

test.describe('forced colors', () => {
  test.use({ forcedColors: 'active' });

  test('the range and colour inputs remain operable', async ({ page }) => {
    const slider = await openSpecimen(page, 'ruler-slider', 'ruler-slider/default');
    const range = slider.getByRole('slider', { name: 'Line weight' });

    await expect(range).toHaveCSS('opacity', '1');
    await range.focus();
    await page.keyboard.press('ArrowRight');
    await expect(slider.locator('output')).toHaveText('41');

    const color = await openSpecimen(page, 'color-field', 'color-field/default');
    const input = color.getByLabel('Canvas color');

    await expect(input).toHaveCSS('opacity', '1');
    await input.focus();
    await expect(input).toBeFocused();
    await input.fill('#336699');
    await expect(input).toHaveValue('#336699');
  });
});
