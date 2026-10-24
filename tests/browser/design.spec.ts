import { type Download, expect, type Page, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const fixtureUrl = pathToFileURL(resolve('.cache/browser-fixture.html')).href;

/** Waits for the file produced by the chosen download action. */
async function downloadImage(page: Page, label: string): Promise<Download> {
  const waiting = page.waitForEvent('download');
  await page.getByRole('button', { name: label, exact: true }).click();
  return waiting;
}

/** Reads a completed browser download from its saved path. */
async function readDownload(download: Download): Promise<Buffer> {
  const file = await download.path();
  if (!file) throw new Error('Download was not saved');
  return readFile(file);
}

/** Inspects decoded raster dimensions and corner transparency. */
async function readPng(page: Page, buffer: Buffer): Promise<{ width: number; height: number; cornerAlpha: number }> {
  return page.evaluate(async base64 => {
    /** Inspects rendered output inside the browser. */
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.drawImage(image, 0, 0);
    return { width: image.width, height: image.height, cornerAlpha: context.getImageData(0, 0, 1, 1).data[3] };
  }, buffer.toString('base64'));
}

test('editing, copying and reopening restores the full design and settled preview', async ({ page, context }) => {
  /** Verifies editing, copying and reopening restores the full design and settled preview. */
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => { document.documentElement.dataset.copiedLink = value; } } });
  });
  await page.goto(`${fixtureUrl}?v=1&seed=234&width=480&height=320`);
  await page.getByRole('button', { name: 'Paper', exact: true }).click();
  await page.getByRole('slider', { name: 'Terrain detail', exact: true }).press('End');
  await page.getByRole('slider', { name: 'Terrain detail', exact: true }).press('ArrowLeft');
  await page.getByRole('button', { name: 'Export ↗' }).click();
  await page.getByLabel('Transparent background').check();
  await page.getByLabel('Format', { exact: true }).selectOption('png');
  await page.getByLabel('Resolution', { exact: true }).selectOption('2');
  await page.getByRole('button', { name: 'Copy link', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Link copied' })).toBeVisible();
  const url = await page.locator('html').getAttribute('data-copied-link');
  expect(url).toBeTruthy();
  expect(new URL(url!).searchParams.get('detail')).toBe('0.99');
  await expect(page.locator('#output-preview-image')).toHaveAttribute('src', /^blob:/);
  const firstPreview = await page.locator('#output-preview-image').evaluate(async image => {
    await (image as HTMLImageElement).decode();
    return fetch((image as HTMLImageElement).src).then(response => response.text());
  });
  const reopened = await context.newPage();
  await reopened.goto(url!);
  await expect(reopened.getByRole('slider', { name: 'Terrain detail', exact: true })).toHaveValue('0.99');
  await expect(reopened.getByRole('button', { name: 'Paper', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await reopened.getByRole('button', { name: 'Export ↗' }).click();
  await expect(reopened.getByLabel('Transparent background')).toBeChecked();
  await expect(reopened.getByLabel('Width', { exact: true })).toHaveValue('480');
  await expect(reopened.getByLabel('Resolution', { exact: true })).toHaveValue('2');
  await expect(reopened.locator('#output-preview-image')).toHaveAttribute('src', /^blob:/);
  const secondPreview = await reopened.locator('#output-preview-image').evaluate(async image => {
    await (image as HTMLImageElement).decode();
    return fetch((image as HTMLImageElement).src).then(response => response.text());
  });
  expect(secondPreview).toBe(firstPreview);
  expect(errors).toEqual([]);
});

test('SVG and PNG downloads match dimensions, transparency and the settled preview', async ({ page }) => {
  /** Verifies SVG and PNG downloads match dimensions, transparency and the settled preview. */
  await page.goto(`${fixtureUrl}?v=1&seed=123&width=320&height=240&cursorEnabled=false`);
  await page.getByRole('button', { name: 'Export ↗' }).click();
  const opaqueSvg = (await readDownload(await downloadImage(page, 'Download SVG'))).toString();
  expect(opaqueSvg).toContain('fill="#202326"');
  await page.getByLabel('Transparent background').check();
  const svgDownload = await downloadImage(page, 'Download SVG');
  expect(svgDownload.suggestedFilename()).toBe('topogra-123-320x240.svg');
  const svg = (await readDownload(svgDownload)).toString();
  expect(svg).not.toContain('fill="#202326"');
  expect(svg).not.toContain('control-panel');
  const preview = await page.locator('#output-preview-image').evaluate(async image => fetch((image as HTMLImageElement).src).then(response => response.text()));
  expect(svg).toBe(preview);
  await page.getByLabel('Format', { exact: true }).selectOption('png');
  for (const scale of [1, 2]) {
    await page.getByLabel('Resolution', { exact: true }).selectOption(String(scale));
    const png = await downloadImage(page, 'Download PNG');
    expect(png.suggestedFilename()).toBe(`topogra-123-${320 * scale}x${240 * scale}.png`);
    expect(await readPng(page, await readDownload(png))).toEqual({ width: 320 * scale, height: 240 * scale, cornerAlpha: 0 });
  }
  await page.getByLabel('Transparent background').uncheck();
  const opaquePng = await readPng(page, await readDownload(await downloadImage(page, 'Download PNG')));
  expect(opaquePng.cornerAlpha).toBe(255);
  await page.getByLabel('Width', { exact: true }).fill('4096');
  await page.getByLabel('Width', { exact: true }).press('Tab');
  await expect(page.getByRole('button', { name: 'Download PNG', exact: true })).toBeDisabled();
  await expect(page.locator('#export-error')).toContainText('4096');
  await page.getByLabel('Resolution', { exact: true }).selectOption('1');
  await expect(page.getByRole('button', { name: 'Download PNG', exact: true })).toBeEnabled();
});

test('mobile controls, invalid links, clipboard fallback and keyboard collapse stay usable', async ({ page }) => {
  /** Verifies mobile controls, invalid links, clipboard fallback and keyboard collapse stay usable. */
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Denied'); } } });
    localStorage.setItem('topogra-locked-seed', '999');
  });
  await page.goto(`${fixtureUrl}?v=1&seed=123&width=480&lineColor=invalid`);
  await expect(page.locator('#seed-value')).toHaveText('123');
  await expect(page.locator('#panel-status')).toContainText('lineColor');
  await page.getByRole('button', { name: 'Copy link', exact: true }).click();
  await expect(page.locator('#manual-link')).toBeVisible();
  expect(await page.locator('#manual-link').inputValue()).toContain('seed=123');
  await page.getByRole('button', { name: 'Export ↗' }).click();
  await page.getByLabel('Size', { exact: true }).selectOption('1080x1920');
  await expect(page.getByLabel('Height', { exact: true })).toHaveValue('1920');
  await page.getByLabel('Height', { exact: true }).press('Escape');
  await expect(page.locator('#export-content')).toBeHidden();
  await page.getByRole('button', { name: 'Export ↗' }).press('Escape');
  await expect(page.getByRole('button', { name: 'Expand controls' })).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Expand controls' }).click();
  await expect(page.locator('#panel-body')).toBeVisible();
  const bounds = await page.locator('.control-panel').boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(358);
  expect(bounds!.height).toBeLessThanOrEqual(812);
  await page.screenshot({ path: 'test-results/mobile-controls.png' });
});
