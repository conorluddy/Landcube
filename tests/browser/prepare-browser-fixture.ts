import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** Inlines the production bundle so browser tests need no local server. */
export default async function prepareBrowserFixture(): Promise<void> {
  let html = await readFile('dist/index.html', 'utf8');

  for (const match of html.matchAll(
    /<script type="module" crossorigin src="([^"]+)"><\/script>/g,
  )) {
    const script = await readFile(path.join('dist', match[1]), 'utf8');

    html = html.replace(match[0], `<script type="module">${script}</script>`);
  }

  for (const match of html.matchAll(/<link rel="stylesheet" crossorigin href="([^"]+)">/g)) {
    const css = await readFile(path.join('dist', match[1]), 'utf8');

    html = html.replace(match[0], `<style>${css}</style>`);
  }

  await mkdir('.cache', { recursive: true });
  await writeFile('.cache/browser-fixture.html', html);
}
