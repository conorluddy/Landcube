import { expect, test, type Page } from '@playwright/test';
import { appUrl, download, modelDownload, section, serveStudio, stlBounds } from './studio-fixture';

test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } });
// Software WebGL on CI runners is several times slower than local GPUs.
test.describe.configure({ timeout: 90_000 });
test.beforeEach(async ({ page }) => {
  await serveStudio(page);
});

async function frameDownload(page: Page): Promise<{ bytes: Buffer; filename: string }> {
  await page.getByRole('button', { name: 'Export ↗' }).click();
  const result = await download(page, 'Download frame STL');

  await page.getByRole('button', { name: 'Close Export', exact: true }).click();

  return result;
}

function navigation(page: Page) {
  return page.getByRole('navigation', { name: 'Editing section' });
}

test('the Frame tab shows only in 3D', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await expect(navigation(page).getByRole('button', { name: 'Frame', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(navigation(page).getByRole('button', { name: 'Frame', exact: true })).toBeVisible();
});

test('a tray downloads at the model size plus border and clearance, leaving the model STL unchanged', async ({
  page,
}) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  const before = await modelDownload(page);

  await section(page, 'Frame');
  await page.getByLabel('Frame style').selectOption('tray');
  const frame = await frameDownload(page);
  const bounds = stlBounds(frame.bytes);

  const header = 'Topogra frame | units: millimeters | Z up';

  expect(frame.bytes.subarray(0, header.length).toString()).toBe(header);
  expect(frame.filename).toMatch(/-frame\.stl$/);
  expect(bounds[0][1] - bounds[0][0]).toBeCloseTo(170.6, 3);
  expect(bounds[1][1] - bounds[1][0]).toBeCloseTo(170.6, 3);
  expect((await modelDownload(page)).equals(before)).toBe(true);
});

test('switching the crop to circle rebuilds a round frame', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await section(page, 'Frame');
  await page.getByLabel('Frame style').selectOption('tray');
  await section(page, 'Model');
  await page.getByLabel('Crop shape').selectOption('circle');
  const bounds = stlBounds((await frameDownload(page)).bytes);

  expect(bounds[0][1] - bounds[0][0]).toBeCloseTo(150 + 2 * 10.3, 2);
  expect(bounds[1][1] - bounds[1][0]).toBeCloseTo(150 + 2 * 10.3, 2);
});

test('an unprintable frame shows its error and disables downloads', async ({ page }) => {
  await page.goto(`${appUrl}?v=1&seed=123`);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await section(page, 'Frame');
  await page.getByLabel('Frame style').selectOption('tray');
  await page.getByLabel('Border (mm)', { exact: true }).fill('1.2');
  await page.getByLabel('Border (mm)', { exact: true }).press('Tab');
  await page.getByLabel('Edge shape').selectOption('chamfer');
  await expect(page.getByRole('alert').filter({ hasText: 'minimum is 1.2 mm' })).toBeVisible();
  await page.getByRole('button', { name: 'Export ↗' }).click();
  await expect(
    page.getByRole('button', { name: 'Download frame STL', exact: true }),
  ).toBeDisabled();
});
