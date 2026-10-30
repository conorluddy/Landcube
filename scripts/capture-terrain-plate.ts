// Captures the terrain image behind design-system plates from the real 3D renderer: the default
// location (bundled tiles, so it works offline) with the UI hidden, greyscaled, 1200px, WebP.
// Run with `npx tsx scripts/capture-terrain-plate.ts` after the renderer's look changes.
import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const outputPath = 'src/system/assets/terrain-plate.webp';
const viewport = { width: 1600, height: 1000 };
/** The model's top surface in the default camera; captured at 2x so the 1200px plate is downscaled. */
const surfaceClip = { x: 420, y: 330, width: 750, height: 440 };
const outputWidthPx = 1200;
const webpQuality = 0.82;
const startupTimeoutMs = 60_000;

const server = await createServer({ logLevel: 'warn', server: { host: '127.0.0.1', port: 0 } });

await server.listen();

const address = server.httpServer?.address();

if (address === null || address === undefined || typeof address === 'string') {
  throw new Error('Vite did not report a port; check that nothing else holds the dev server.');
}

const launchArgs = ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
// Prefer installed Chrome (as the e2e suite does); fall back to Playwright's bundled Chromium.
const browser = await chromium
  .launch({ channel: 'chrome', args: launchArgs })
  .catch(() => chromium.launch({ args: launchArgs }));

try {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });

  await page.goto(`http://127.0.0.1:${String(address.port)}/`);
  await page
    .getByRole('status')
    .filter({ hasText: 'Real terrain loaded' })
    .waitFor({ timeout: startupTimeoutMs });
  // Everything but the canvas goes, so the frame is terrain only.
  await page.addStyleTag({
    content: '.studio-shell > :not(.studio-viewport) { display: none !important; }',
  });
  // The renderer marks the canvas once a morph has finished; capture only a settled frame.
  await page.locator('canvas.terrain-3d[data-terrain-transition="settled"]').waitFor({
    timeout: startupTimeoutMs,
  });
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }),
  );

  const screenshot = await page.screenshot({ type: 'png', clip: surfaceClip });
  const webpDataUrl = await page.evaluate(
    async ({ pngBase64, widthPx, quality }) => {
      const image = new Image();

      image.src = `data:image/png;base64,${pngBase64}`;
      await image.decode();

      const canvas = document.createElement('canvas');

      canvas.width = widthPx;
      canvas.height = Math.round((image.height / image.width) * widthPx);

      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('No 2D canvas context to encode the plate.');
      }

      context.filter = 'grayscale(1)';
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      return canvas.toDataURL('image/webp', quality);
    },
    { pngBase64: screenshot.toString('base64'), widthPx: outputWidthPx, quality: webpQuality },
  );
  const webp = Buffer.from(webpDataUrl.slice(webpDataUrl.indexOf(',') + 1), 'base64');

  await writeFile(outputPath, webp);
  console.info(
    JSON.stringify({ event: 'terrain_plate_captured', path: outputPath, bytes: webp.length }),
  );
} finally {
  await browser.close();
  await server.close();
}
