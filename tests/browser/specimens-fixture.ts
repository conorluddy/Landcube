import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';

export const specimensUrl = 'https://specimens.test/';

/** Serves dist-specimens/ at specimensUrl, mirroring serveStudio. */
export async function serveSpecimens(page: Page): Promise<void> {
  await page.route(`${specimensUrl}**`, async (route) => {
    const filename = new URL(route.request().url()).pathname.slice(1) || 'specimens.html';

    await route.fulfill({
      body: await readFile(resolve('dist-specimens', filename)),
      contentType: filename.endsWith('.js')
        ? 'text/javascript'
        : filename.endsWith('.css')
          ? 'text/css'
          : filename.endsWith('.woff2')
            ? 'font/woff2'
            : 'text/html',
    });
  });
}
