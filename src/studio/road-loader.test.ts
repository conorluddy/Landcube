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

void test('revisiting a cached place keeps it from being evicted next', async () => {
  let downloads = 0;
  const loader = createRoadNetworkLoader(() => {
    downloads++;

    return Promise.resolve(roadsResponse());
  });

  for (let index = 0; index < 5; index++) {
    await loader.load(placement(-6 - index));
  }

  await loader.load(placement(-6));
  await loader.load(placement(-20));
  await loader.load(placement(-6));
  assert.equal(downloads, 6, 'the revisited place survived the sixth place');
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

void test('a final failure is remembered, so switching roads back on never re-downloads it', async () => {
  let downloads = 0;
  const loader = createRoadNetworkLoader(() => {
    downloads++;

    return Promise.resolve(
      new Response('{}', { headers: { 'content-length': String(64 * 1024 * 1024) } }),
    );
  });

  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await loader.load(placement(-6));

    assert.ok(result !== undefined && !result.ok);
    assert.match(result.error.message, /smaller area/);
  }

  assert.equal(downloads, 1);
});

void test('a retryable failure is fetched again on the next attempt', async () => {
  let downloads = 0;
  const loader = createRoadNetworkLoader(() => {
    downloads++;

    return Promise.resolve(new Response('', { status: 502 }));
  });

  await loader.load(placement(-6));
  await loader.load(placement(-6));
  assert.equal(downloads, 2);
});
