import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TerrainLoadError } from './terrain-load-error';
import { downloadTerrainTile } from './terrain-tile-download';

void test('tile errors identify the URL and preserve underlying network failures', async (context) => {
  const cause = Object.assign(new Error('getaddrinfo failed'), { code: 'ENOTFOUND' });
  const failure = new TypeError('fetch failed', { cause });

  context.mock.method(globalThis, 'fetch', () => Promise.reject(failure));
  await assert.rejects(downloadTerrainTile('https://example.test/12/1/2.png'), (error: Error) => {
    assert.match(error.message, /12\/1\/2\.png.*fetch failed.*getaddrinfo failed.*ENOTFOUND/);
    assert.equal(error.cause, failure);

    return true;
  });
});

void test('tile errors distinguish HTTP failures and timeouts', async (context) => {
  const fetchMock = context.mock.method(globalThis, 'fetch', () =>
    Promise.resolve(new Response(null, { status: 503 })),
  );

  await assert.rejects(downloadTerrainTile('https://example.test/tile.png'), /HTTP 503/);
  fetchMock.mock.mockImplementation(() =>
    Promise.reject(new DOMException('Timed out', 'TimeoutError')),
  );
  await assert.rejects(downloadTerrainTile('https://example.test/tile.png'), /Timed out/);
});

void test('tile download failures carry the download fault kind', async (context) => {
  context.mock.method(globalThis, 'fetch', () =>
    Promise.resolve(new Response(null, { status: 500 })),
  );
  await assert.rejects(
    downloadTerrainTile('https://example.test/tile.png'),
    (error: TerrainLoadError) => error.kind === 'tileDownloadFailed',
  );
});

void test('cancelling stops an in-flight tile download', async (context) => {
  context.mock.method(
    globalThis,
    'fetch',
    (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new Error('aborted'));
        });
      }),
  );
  const cancel = new AbortController();
  const download = downloadTerrainTile('https://example.test/tile.png', cancel.signal);

  cancel.abort();
  await assert.rejects(download, /aborted/);
});
