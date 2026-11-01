import { expect, test, type Page } from '@playwright/test';
import { appUrl, section, serveStudio } from './studio-fixture';

const phone = { width: 390, height: 844 };

test.use({ viewport: phone });
test.beforeEach(async ({ page }) => {
  await serveStudio(page);
  await page.goto(`${appUrl}?v=1&seed=123`);
});

function sheet(page: Page) {
  return page.getByRole('complementary', { name: 'Landscape controls' });
}

function shell(page: Page) {
  return page.locator('.studio-shell');
}

async function sheetHeight(page: Page): Promise<number> {
  return (await sheet(page).boundingBox())?.height ?? 0;
}

/** The handle moves while the sheet animates, so drags start once its transition ends. */
async function waitForSettledSheet(page: Page): Promise<void> {
  await expect
    .poll(() => sheet(page).evaluate((element) => element.getAnimations().length))
    .toBe(0);
}

/** Drags the sheet handle vertically by `distancePx` in `steps` pointer moves `stepDelayMs` apart. */
async function dragHandle(
  page: Page,
  distancePx: number,
  steps: number,
  stepDelayMs: number,
): Promise<void> {
  await waitForSettledSheet(page);
  const grip = await page.getByRole('button', { name: 'Resize sheet' }).boundingBox();

  if (grip === null) {
    throw new Error('Sheet handle is not laid out.');
  }

  const x = grip.x + grip.width / 2;
  const y = grip.y + grip.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();

  for (let step = 1; step <= steps; step++) {
    await page.mouse.move(x, y + (distancePx * step) / steps);

    if (stepDelayMs > 0) {
      await page.waitForTimeout(stepDelayMs);
    }
  }

  await page.mouse.up();
}

test('the phone inspector is a bottom sheet that opens at half', async ({ page }) => {
  await expect(shell(page)).toHaveAttribute('data-sheet-snap', 'half');
  await expect(sheet(page)).toHaveAttribute('id', 'studio-inspector');
  await expect(page.getByRole('button', { name: 'Resize sheet' })).toHaveAttribute(
    'aria-controls',
    'studio-inspector',
  );
  expect(await sheetHeight(page)).toBeLessThanOrEqual(phone.height * 0.62);
  await expect(page.getByRole('button', { name: 'Export ↗' })).toHaveCount(1);
});

test('keyboard on the handle steps between closed, peek, half and full', async ({ page }) => {
  const handle = page.getByRole('button', { name: 'Resize sheet' });

  await handle.focus();
  await page.keyboard.press('ArrowUp');
  await expect(shell(page)).toHaveAttribute('data-sheet-snap', 'full');
  await expect.poll(() => sheetHeight(page)).toBe(phone.height - 64);
  await page.keyboard.press('Enter');
  await expect(shell(page)).toHaveAttribute('data-sheet-snap', 'half');
  await page.keyboard.press('Escape');
  await expect(shell(page)).toHaveAttribute('data-sheet-snap', 'peek');
  await expect.poll(() => sheetHeight(page)).toBe(190);
  await expect(handle).toHaveAttribute('aria-valuetext', 'peek');
  await page.keyboard.press('ArrowDown');
  await expect(shell(page)).toHaveAttribute('data-sheet-snap', 'closed');
  await expect.poll(() => sheetHeight(page)).toBe(44);
  await page.keyboard.press('ArrowDown');
  await expect(shell(page)).toHaveAttribute('data-sheet-snap', 'closed');
  await page.keyboard.press('ArrowUp');
  await expect(shell(page)).toHaveAttribute('data-sheet-snap', 'peek');
  await page.keyboard.press('ArrowUp');
  await expect(shell(page)).toHaveAttribute('data-sheet-snap', 'half');
});

test('a closed sheet leaves only its notch, and a tap on the notch reopens it', async ({
  page,
}) => {
  const handle = page.getByRole('button', { name: 'Resize sheet' });

  await handle.focus();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(shell(page)).toHaveAttribute('data-sheet-snap', 'closed');
  await expect(page.getByRole('button', { name: 'Export ↗' })).not.toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(shell(page)).toHaveAttribute('data-sheet-snap', 'closed');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Export ↗' })).not.toBeFocused();
  await handle.click();
  await expect(shell(page)).toHaveAttribute('data-sheet-snap', 'peek');
});

test('a slow drag down from peek closes the sheet, and a tap on the grip reopens it', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Resize sheet' }).focus();
  await page.keyboard.press('Escape');
  await dragHandle(page, 150, 6, 50);
  await expect(shell(page)).toHaveAttribute('data-sheet-snap', 'closed');
  await waitForSettledSheet(page);
  const grip = await page.locator('.lc-bottom-sheet__grip').boundingBox();

  if (grip === null) {
    throw new Error('Sheet grip is not laid out.');
  }

  await page.mouse.click(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await expect(shell(page)).toHaveAttribute('data-sheet-snap', 'peek');
});

test('closing the sheet by touch moves focus from its content to the grip', async ({ page }) => {
  await page.getByRole('button', { name: 'Resize sheet' }).focus();
  await page.keyboard.press('Escape');
  await waitForSettledSheet(page);
  const grip = await page.getByRole('button', { name: 'Resize sheet' }).boundingBox();

  if (grip === null) {
    throw new Error('Sheet handle is not laid out.');
  }

  // Touch, unlike a mouse press, does not focus the grip, so focus stays on Export until the close.
  const exportButton = page.getByRole('button', { name: 'Export ↗' });

  await exportButton.focus();
  const x = grip.x + grip.width / 2;
  const startY = grip.y + grip.height / 2;
  const touch = await page.context().newCDPSession(page);
  const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', y: number) =>
    touch.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
    });

  await send('touchStart', startY);

  for (let step = 1; step <= 5; step++) {
    await send('touchMove', startY + step * 30);
    await page.waitForTimeout(150);
  }

  await send('touchEnd', startY + 150);
  await expect(shell(page)).toHaveAttribute('data-sheet-snap', 'closed');
  await expect(page.getByRole('button', { name: 'Resize sheet' })).toBeFocused();
});

test('a tool leaves a closed sheet closed', async ({ page }) => {
  await page.getByRole('button', { name: 'Resize sheet' }).focus();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Measure tool' }).click();
  await expect(shell(page)).toHaveAttribute('data-sheet-snap', 'closed');
});

test('closing the sheet staggers in the sheet shortcuts, and reopening it takes them away', async ({
  page,
}) => {
  const shortcuts = page.getByRole('group', { name: 'Open controls' });
  const colour = page.getByRole('button', { name: 'Colour controls' });

  await expect(shortcuts).toBeHidden();
  await page.getByRole('button', { name: 'Resize sheet' }).focus();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(shell(page)).toHaveAttribute('data-sheet-snap', 'closed');
  await expect(colour).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeVisible();
  // Later items wait for the earlier ones, so the stagger reads as a cascade.
  const delaySeconds = async (name: string) =>
    Number.parseFloat(
      await page
        .getByRole('button', { name })
        .locator('xpath=..')
        .evaluate((element) => getComputedStyle(element).transitionDelay),
    );

  expect(await delaySeconds('Colour controls')).toBeGreaterThan(
    await delaySeconds('Terrain controls'),
  );
  await page.keyboard.press('ArrowUp');
  await expect(shell(page)).toHaveAttribute('data-sheet-snap', 'peek');
  await expect(shortcuts).toBeHidden();
});

test('reduced motion shows the shortcuts without a stagger', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Resize sheet' }).focus();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  const item = page.getByRole('button', { name: 'Colour controls' }).locator('xpath=..');

  await expect(item).toBeVisible();
  await expect(item).toHaveCSS('transition-duration', '0s');
  await expect(item).toHaveCSS('transition-delay', '0s');
});

test('on a short phone the shortcuts wrap beside the tools instead of reaching the sheet', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 420 });
  await page.getByRole('button', { name: 'Resize sheet' }).focus();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  const exportShortcut = page.getByRole('button', { name: 'Export', exact: true });

  await expect(exportShortcut).toBeVisible();
  // The grip is still travelling down while the sheet closes; measure once it has settled.
  await waitForSettledSheet(page);
  const exportBox = await exportShortcut.boundingBox();
  const measureBox = await page.getByRole('button', { name: 'Measure tool' }).boundingBox();
  const gripBox = await page.getByRole('button', { name: 'Resize sheet' }).boundingBox();

  expect(exportBox && measureBox && exportBox.x < measureBox.x).toBe(true);
  expect(exportBox && gripBox && exportBox.y + exportBox.height <= gripBox.y).toBe(true);
  // The second column grows leftwards into the canvas, never past the viewport's left edge.
  expect(exportBox && exportBox.x >= 0).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('a sheet shortcut opens the sheet full on its section with focus in its group', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Resize sheet' }).focus();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Colour controls' }).click();
  await expect(shell(page)).toHaveAttribute('data-sheet-snap', 'full');
  await expect(
    page
      .getByRole('navigation', { name: 'Editing section' })
      .getByRole('button', { name: 'Colour', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('region', { name: 'Colour settings' })).toBeVisible();
  await expect(page.locator('[data-group-id="palette"] :focus')).toHaveCount(1);
});

test('the Export shortcut opens export from a closed sheet', async ({ page }) => {
  await page.getByRole('button', { name: 'Resize sheet' }).focus();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Close Export' })).toBeVisible();
});

test('a full sheet hides the map controls and the scale bar', async ({ page }) => {
  const measure = page.getByRole('button', { name: 'Measure tool', exact: true });
  const scaleBar = page.locator('[data-hud] .lc-hud-layer__instruments .lc-scale-bar');

  await expect(measure).toBeVisible();
  await expect(scaleBar).toBeVisible();
  await page.getByRole('button', { name: 'Resize sheet' }).focus();
  await page.keyboard.press('ArrowUp');
  await expect(measure).toBeHidden();
  await expect(scaleBar).toBeHidden();
});

test('map controls are 44px and toggle their tool', async ({ page }) => {
  const measure = page.getByRole('button', { name: 'Measure tool', exact: true });
  const box = await measure.boundingBox();

  expect([box?.width, box?.height]).toEqual([44, 44]);
  await measure.click();
  await expect(measure).toHaveAttribute('aria-pressed', 'true');
});

test('the sheet animates between snaps unless reduced motion is set', async ({ page }) => {
  await expect(sheet(page)).toHaveCSS('transition-duration', '0.32s');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(sheet(page)).toHaveCSS('transition-duration', '0s');
  await page.getByRole('button', { name: 'Resize sheet' }).focus();
  await page.keyboard.press('Escape');
  expect(await sheetHeight(page)).toBe(190);
});

test('the body scrolls at half and is locked at peek', async ({ page }) => {
  const body = page.locator('.lc-bottom-sheet__body');
  const scrollBody = async () =>
    body.evaluate((element) => {
      element.scrollTop = 200;

      return element.scrollTop;
    });

  expect(await scrollBody()).toBeGreaterThan(0);
  await body.evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.getByRole('button', { name: 'Resize sheet' }).focus();
  await page.keyboard.press('Escape');
  await expect(body).toHaveCSS('overflow-y', 'hidden');
  await page.mouse.move(195, 800);
  await page.mouse.wheel(0, 400);
  expect(await body.evaluate((element) => element.scrollTop)).toBe(0);
});

test('a slow drag follows the pointer and settles on the nearest snap', async ({ page }) => {
  const grip = await page.getByRole('button', { name: 'Resize sheet' }).boundingBox();
  const halfHeight = await sheetHeight(page);

  if (grip === null) {
    throw new Error('Sheet handle is not laid out.');
  }

  await page.mouse.move(grip.x + 20, grip.y + 10);
  await page.mouse.down();
  await page.mouse.move(grip.x + 20, grip.y + 110, { steps: 5 });
  expect(await sheetHeight(page)).toBeCloseTo(halfHeight - 100, 0);
  await page.waitForTimeout(150);
  await page.mouse.up();
  await expect(shell(page)).toHaveAttribute('data-sheet-snap', 'half');
  // 150 ms apart keeps each move well under the flick speed even when CI delivers events late.
  await dragHandle(page, 300, 10, 150);
  await expect(shell(page)).toHaveAttribute('data-sheet-snap', 'peek');
  await dragHandle(page, -540, 18, 150);
  await expect(shell(page)).toHaveAttribute('data-sheet-snap', 'full');
});

test('a fast flick steps one snap in its direction', async ({ page }) => {
  // Two 60 px moves with no delay: above the 0.5 px/ms flick threshold unless CI spaces them over
  // 120 ms apart. Released slowly, the same 120 px drag settles back to the snap it started on.
  await dragHandle(page, -120, 2, 0);
  await expect(shell(page)).toHaveAttribute('data-sheet-snap', 'full');
  await dragHandle(page, 120, 2, 0);
  await expect(shell(page)).toHaveAttribute('data-sheet-snap', 'half');
});

test('touch drags on the handle move the sheet', async ({ page }) => {
  await waitForSettledSheet(page);
  const grip = await page.getByRole('button', { name: 'Resize sheet' }).boundingBox();

  if (grip === null) {
    throw new Error('Sheet handle is not laid out.');
  }

  const x = grip.x + grip.width / 2;
  const startY = grip.y + grip.height / 2;
  const touch = await page.context().newCDPSession(page);
  const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', y: number) =>
    touch.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
    });

  await send('touchStart', startY);

  for (let step = 1; step <= 10; step++) {
    await send('touchMove', startY + step * 30);
    await page.waitForTimeout(150);
  }

  await send('touchEnd', startY + 300);
  await expect(shell(page)).toHaveAttribute('data-sheet-snap', 'peek');
});

test('choosing a section from peek opens the sheet to half', async ({ page }) => {
  await page.getByRole('button', { name: 'Resize sheet' }).focus();
  await page.keyboard.press('Escape');
  await page
    .getByRole('navigation', { name: 'Editing section' })
    .getByRole('button', { name: 'Colour', exact: true })
    .click();
  await expect(shell(page)).toHaveAttribute('data-sheet-snap', 'half');
  await expect(page.getByRole('region', { name: 'Colour settings' })).toBeVisible();
});

function pages(page: Page) {
  return page.getByRole('navigation', { name: 'Pages' });
}

async function openPage(page: Page, name: string): Promise<void> {
  await pages(page).getByRole('button', { name, exact: true }).click();
}

test('the tab bar is 84px tall under the sheet and the studio is the current page', async ({
  page,
}) => {
  const box = await pages(page).boundingBox();

  expect([box?.height, (box?.y ?? 0) + (box?.height ?? 0)]).toEqual([84, phone.height]);
  await expect(pages(page).getByRole('button', { name: 'Studio', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(pages(page).locator('[aria-current="page"]')).toHaveCount(1);
});

test('tab bar navigation hides the studio and shows the Library, then returns', async ({
  page,
}) => {
  await openPage(page, 'Library');
  await expect(pages(page).getByRole('button', { name: 'Library' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('region', { name: 'Library' })).toBeVisible();
  await expect(shell(page)).toBeHidden();
  await expect(page.locator('#terrain')).toBeAttached();
  await openPage(page, 'Studio');
  await expect(shell(page)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Library' })).toBeHidden();
});

test('a saved design survives a reload and opening it restores the seed', async ({ page }) => {
  await openPage(page, 'Library');
  await expect(page.getByText('No saved designs')).toBeVisible();
  await page.getByRole('button', { name: 'Save current' }).click();
  const card = page.locator('.lc-model-card');

  await expect(card).toHaveCount(1);
  await expect(card.locator('img')).toHaveCount(1);
  await page.goto(`${appUrl}?v=1&seed=456`);
  await openPage(page, 'Library');
  await expect(card).toHaveCount(1);
  await card.getByRole('button').first().click();
  await expect(shell(page)).toBeVisible();
  await expect(page.locator('#seed-value')).toHaveText('123');
});

test('deleting a saved design empties the Library', async ({ page }) => {
  await openPage(page, 'Library');
  await page.getByRole('button', { name: 'Save current' }).click();
  await page.getByRole('button', { name: 'Delete Seed 123' }).click();
  await expect(page.getByText('No saved designs')).toBeVisible();
});

test('corrupt saved designs show an empty Library with a message', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('landcube-saved-designs', '{broken');
  });
  await openPage(page, 'Library');
  await expect(page.getByText('No saved designs')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('corrupt');
});

test('applying a palette preset changes the canvas colour', async ({ page }) => {
  await section(page, 'Colour');
  const before = await page.getByLabel('Canvas color').inputValue();

  await openPage(page, 'Presets');
  await page
    .getByRole('group', { name: 'Palettes' })
    .getByRole('button', { name: 'Blueprint' })
    .click();
  await openPage(page, 'Studio');
  await section(page, 'Colour');
  await expect(page.getByLabel('Canvas color')).not.toHaveValue(before);
  await expect(page.getByLabel('Canvas color')).toHaveValue('#153c68');
});

test('the Account theme row sets data-theme on the document and persists', async ({ page }) => {
  await openPage(page, 'Account');
  await page.getByRole('group', { name: 'Theme' }).getByRole('button', { name: 'Light' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(() => localStorage.getItem('landcube-theme'))).toBe('light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('the Account signal accent sets data-signal-accent and persists', async ({ page }) => {
  await openPage(page, 'Account');
  await page
    .getByRole('group', { name: 'Signal accent' })
    .getByRole('button', { name: 'Amber' })
    .click();
  await expect(page.locator('html')).toHaveAttribute('data-signal-accent', 'amber');
  expect(await page.evaluate(() => localStorage.getItem('landcube-signal-accent'))).toBe('amber');
});

test('clearing local storage from Account empties the Library after confirming', async ({
  page,
}) => {
  await openPage(page, 'Library');
  await page.getByRole('button', { name: 'Save current' }).click();
  await expect(page.locator('.lc-model-card')).toHaveCount(1);
  await openPage(page, 'Account');
  await page.getByRole('button', { name: /Clear local storage/ }).click();
  expect(await page.evaluate(() => localStorage.getItem('landcube-saved-designs'))).not.toBeNull();
  await page.getByRole('button', { name: 'Confirm clear' }).click();
  await expect(page.getByText('Local storage cleared.')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('landcube-saved-designs'))).toBeNull();
  await openPage(page, 'Library');
  await expect(page.getByText('No saved designs')).toBeVisible();
});

test('a fresh phone session shows the splash until Enter studio, then not again', async ({
  page,
}) => {
  await page.evaluate(() => {
    sessionStorage.clear();
  });
  await page.goto(appUrl);
  const enter = page.getByRole('button', { name: 'Enter studio' });

  await expect(page.getByRole('region', { name: 'Welcome' })).toBeVisible();
  await enter.click();
  await expect(enter).toBeHidden();
  await page.reload();
  await expect(enter).toBeHidden();
});

test('closing the sheet after a shortcut opened it keeps focus on the handle, not body', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Resize sheet' }).focus();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Colour controls' }).click();
  await expect(page.locator('[data-group-id="palette"] :focus')).toHaveCount(1);
  await dragHandle(page, 700, 10, 60);
  await expect(shell(page)).toHaveAttribute('data-sheet-snap', 'closed');
  await expect(page.getByRole('button', { name: 'Resize sheet' })).toBeFocused();
});

test('closing the export dialog returns focus to the Export shortcut', async ({ page }) => {
  await page.getByRole('button', { name: 'Resize sheet' }).focus();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  const exportShortcut = page.getByRole('button', { name: 'Export', exact: true });

  await exportShortcut.click();
  await expect(page.getByRole('button', { name: 'Close Export' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Close Export' })).toBeHidden();
  await expect(exportShortcut).toBeFocused();
});
