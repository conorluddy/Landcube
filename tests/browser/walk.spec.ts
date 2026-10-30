import { expect, test, type Page } from '@playwright/test';
import { openDefaultStudio, serveStudio } from './studio-fixture';

// Headless Chromium refuses pointer lock; the walk still starts and keys still drive it.
test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } });
test.beforeEach(async ({ page }) => {
  await serveStudio(page);
  await openDefaultStudio(page);
});

test('F drops into first person, collapses the inspector, and Esc returns to orbit', async ({
  page,
}) => {
  const inspectorToggle = page.getByRole('button', { name: /(Expand|Collapse) controls/ });
  const wasExpanded = await inspectorToggle.getAttribute('aria-expanded');

  await page.locator('canvas.terrain-3d').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('f');
  await expectWalking(page, true);
  await expect(page.locator('.terrain-walk-hint')).toContainText('Esc exit');
  await expect(page.locator('.lc-crosshair')).toBeHidden();

  await page.keyboard.press('Escape');
  await expectWalking(page, false);
  await expect(page.locator('.terrain-walk-hint')).toHaveCount(0);
  await expect(inspectorToggle).toHaveAttribute('aria-expanded', wasExpanded ?? 'true');
});

test('dragging the walker onto the model starts a walk; dropping off it does not', async ({
  page,
}) => {
  const walker = page.getByRole('button', { name: /walk the landscape/i });

  await dragWalkerTo(page, walker, { x: 2, y: 2 });
  await expect(walker).toHaveAttribute('data-missed', 'true');
  await expectWalking(page, false);

  const canvas = await page.locator('canvas.terrain-3d').boundingBox();

  if (!canvas) {
    throw new Error('3D canvas has no bounding box; the renderer did not mount.');
  }

  await dragWalkerTo(page, walker, {
    x: canvas.x + canvas.width / 2,
    y: canvas.y + canvas.height / 2,
  });
  await expectWalking(page, true);
});

test('leaving 3D ends the walk and stops capturing keys', async ({ page }) => {
  await page.locator('canvas.terrain-3d').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('f');
  await expectWalking(page, true);

  // A walker's pointer is locked, so leaving 3D mid-walk is programmatic (tour, palette, link).
  await page.getByRole('button', { name: '2D', exact: true }).dispatchEvent('click');
  await expectWalking(page, false);

  const search = page.getByPlaceholder('Mountain, town, lake…').first();

  await search.fill('');
  await search.pressSequentially('wasd');
  await expect(search).toHaveValue('wasd');
});

// === HELPERS ===

async function expectWalking(page: Page, isWalking: boolean): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.hasAttribute('data-walking')))
    .toBe(isWalking);
}

async function dragWalkerTo(
  page: Page,
  walker: ReturnType<Page['getByRole']>,
  target: { x: number; y: number },
): Promise<void> {
  const box = await walker.boundingBox();

  if (!box) {
    throw new Error('Walker button has no bounding box; it only renders in 3D on fine pointers.');
  }

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 8 });
  await page.mouse.up();
}
