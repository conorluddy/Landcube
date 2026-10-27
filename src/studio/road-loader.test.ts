import assert from 'node:assert/strict';
import test from 'node:test';
import { createRoadNetworkLoader } from './road-loader';

function placement(longitude: number, spanKm = 10) {
  return { location: { latitude: 53, longitude }, spanKm };
}

function roadsResponse(): Response {
  return Response.json({
    elements: [
      {
        type: 'way',
        id: 1,
        tags: { highway: 'primary' },
        geometry: [
          { lat: 53, lon: -6 },
          { lat: 53.01, lon: -6 },
        ],
      },
    ],
  });
}

void test('a revisited place is served from the cache without another download', async () => {
  let downloads = 0;
  const loader = createRoadNetworkLoader(() => {
    downloads++;

    return Promise.resolve(roadsResponse());
  });

  const first = await loader.load(placement(-6));
  const second = await loader.load(placement(-6));

  assert.equal(downloads, 1);
  assert.ok(first?.ok === true && second?.ok === true);
  assert.equal(first.data, second.data);
});

void test('only the most recent places stay cached', async () => {
  let downloads = 0;
  const loader = createRoadNetworkLoader(() => {
    downloads++;

    return Promise.resolve(roadsResponse());
  });

  for (let index = 0; index < 6; index++) {
    await loader.load(placement(-6 - index));
  }

  await loader.load(placement(-11));
  assert.equal(downloads, 6, 'the newest place is still cached');
  await loader.load(placement(-6));
  assert.equal(downloads, 7, 'the oldest place was evicted');
});

void test('a newer request supersedes and aborts the one in flight', async () => {
  const signals: AbortSignal[] = [];
  const loader = createRoadNetworkLoader((_url, init) => {
    if (init?.signal) {
      signals.push(init.signal);
    }

    return Promise.resolve(roadsResponse());
  });
  const superseded = loader.load(placement(-6));
  const current = loader.load(placement(-7));

  assert.equal(await superseded, undefined);
  assert.equal((await current)?.ok, true);
  assert.equal(signals[0]?.aborted, true);
});

void test('areas too large for roads fail without a download or a retry', async () => {
  const loader = createRoadNetworkLoader(() => Promise.reject(new Error('should not download')));
  const result = await loader.load(placement(-6, 150));

  assert.ok(result !== undefined && !result.ok);
  assert.equal(result.error.retryable, false);
});
