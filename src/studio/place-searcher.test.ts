import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlaceSearcher } from './place-searcher';

function photonResponse(name: string): Response {
  return Response.json({
    features: [{ geometry: { coordinates: [-5, 56.8] }, properties: { name } }],
  });
}

void test('a repeated query is served from the cache without another request', async () => {
  let requests = 0;
  const searcher = createPlaceSearcher(() => {
    requests++;

    return Promise.resolve(photonResponse('Ben Nevis'));
  });

  const first = await searcher.search('Ben Nevis');
  const second = await searcher.search('  ben   NEVIS ');

  assert.equal(requests, 1);
  assert.ok(first?.ok === true && second?.ok === true);
  assert.deepEqual(first.data, second.data);
});

void test('a newer query supersedes the one still in flight', async () => {
  const searcher = createPlaceSearcher((input, init) => {
    if ((input instanceof Request ? input.url : input.toString()).includes('q=ben+nev')) {
      return Promise.resolve(photonResponse('Ben Nevis'));
    }

    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });
  });

  const stale = searcher.search('Ben');
  const fresh = searcher.search('Ben Nev');

  assert.equal(await stale, undefined);
  assert.equal((await fresh)?.ok, true);
});
