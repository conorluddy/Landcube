import { expect, test, type Locator, type Page } from '@playwright/test';
import { serveSpecimens, specimensUrl } from './specimens-fixture';

// One walk per component: tabbing the whole catalogue takes 600+ presses and outruns CI's timeout.
const tabbableComponents = [
  { component: 'button', control: 'button:not(:disabled)' },
  { component: 'icon-button', control: 'button:not(:disabled)' },
  { component: 'sheet-handle', control: 'button' },
] as const;

interface FocusedSpecimen {
  specimen: string;
  matches: boolean;
  outlineStyle: string;
  outlineWidth: string;
}

for (const { component, control } of tabbableComponents) {
  test(`Tab reaches every enabled ${component} with a visible focus ring`, async ({ page }) => {
    await openSpecimens(page, component);
    const interactiveSelector = `[data-specimen^="${component}/"] ${control}`;
    const expectedCount = await page.locator(interactiveSelector).count();
    const reached = new Set<string>();

    expect(expectedCount).toBeGreaterThan(0);

    // A loop guard, not an assertion: it must outgrow every tabbable stop on the filtered page.
    for (let step = 0; step < 200 && reached.size < expectedCount; step++) {
      await page.keyboard.press('Tab');

      const focused = await describeFocusedSpecimen(page, interactiveSelector);

      if (focused?.matches === true) {
        expect(focused.outlineStyle, `${focused.specimen} focus outline`).not.toBe('none');
        expect(focused.outlineWidth, `${focused.specimen} focus outline width`).not.toBe('0px');
        reached.add(focused.specimen);
      }
    }

    expect(reached.size).toBe(expectedCount);
  });
}

test('SheetHandle steps snaps with arrows, toggles with Enter and resets with Escape', async ({
  page,
}) => {
  await openSpecimens(page, 'sheet-handle');
  const handle = page.locator('[data-specimen="sheet-handle/peek"] button');

  await handle.focus();
  await expectSnap(handle, 'peek');

  await page.keyboard.press('ArrowDown');
  await expectSnap(handle, 'closed');

  await page.keyboard.press('ArrowDown');
  await expectSnap(handle, 'closed');

  await page.keyboard.press('ArrowUp');
  await expectSnap(handle, 'peek');

  await page.keyboard.press('ArrowUp');
  await expectSnap(handle, 'half');

  await page.keyboard.press('ArrowUp');
  await expectSnap(handle, 'full');

  await page.keyboard.press('ArrowUp');
  await expectSnap(handle, 'full');

  await page.keyboard.press('Enter');
  await expectSnap(handle, 'half');

  await page.keyboard.press('Enter');
  await expectSnap(handle, 'full');

  await page.keyboard.press('ArrowDown');
  await expectSnap(handle, 'half');

  await page.keyboard.press('Escape');
  await expectSnap(handle, 'peek');

  await page.keyboard.press('Enter');
  await expectSnap(handle, 'half');
});

// === HELPERS ===

async function openSpecimens(page: Page, component: string): Promise<void> {
  await serveSpecimens(page);
  await page.goto(`${specimensUrl}specimens.html?only=${component}`);
  await page.evaluate(() => document.fonts.ready);
}

async function expectSnap(handle: Locator, snap: string): Promise<void> {
  await expect(handle).toHaveAttribute('aria-valuetext', snap);
}

async function describeFocusedSpecimen(
  page: Page,
  interactiveSelector: string,
): Promise<FocusedSpecimen | undefined> {
  return page.evaluate((selector) => {
    const element = document.activeElement;
    const specimen = element?.closest('[data-specimen]')?.getAttribute('data-specimen');

    if (element === null || specimen === null || specimen === undefined) {
      return undefined;
    }

    const style = getComputedStyle(element);

    return {
      specimen,
      matches: element.matches(selector),
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
    };
  }, interactiveSelector);
}
