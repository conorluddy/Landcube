import assert from 'node:assert/strict';
import test from 'node:test';
import { parseOpenMeteoPlaces, parsePhotonPlaces, searchPlaces } from './place-search';

const photonBody = {
  features: [
    {
      geometry: { coordinates: [-5.0037, 56.7969] },
      properties: { name: 'Ben Nevis', state: 'Scotland', country: 'United Kingdom' },
    },
  ],
};

const openMeteoBody = {
  results: [
    {
      name: 'Ben Nevis',
      admin1: 'Scotland',
      country: 'United Kingdom',
      latitude: 56.8,
      longitude: -5,
    },
  ],
};

function isPhoton(input: Parameters<typeof fetch>[0]): boolean {
  return (input instanceof Request ? input.url : input.toString()).includes('photon');
}

void test('photon points are read as longitude then latitude', () => {
  const result = parsePhotonPlaces(photonBody);

  assert.ok(result.ok);
  assert.deepEqual(result.data, [
    {
      name: 'Ben Nevis',
      detail: 'Scotland, United Kingdom',
      latitude: 56.7969,
      longitude: -5.0037,
      provider: 'photon',
    },
  ]);
});

void test('places beyond the real terrain latitude limit are dropped', () => {
  const result = parsePhotonPlaces({
    features: [{ geometry: { coordinates: [0, 89] }, properties: { name: 'North Pole' } }],
  });

  assert.ok(result.ok);
  assert.deepEqual(result.data, []);
});

void test('open-meteo without results means no matches', () => {
  assert.deepEqual(parseOpenMeteoPlaces({ generationtime_ms: 1 }), { ok: true, data: [] });
});

void test('a short query makes no request', async () => {
  let requests = 0;
  const result = await searchPlaces(' be ', () => {
    requests++;

    return Promise.resolve(Response.json(photonBody));
  });

  assert.equal(requests, 0);
  assert.deepEqual(result, { ok: true, data: [] });
});

void test('photon answering 503 falls back to open-meteo', async () => {
  const result = await searchPlaces('Ben Nevis', (input) =>
    Promise.resolve(
      isPhoton(input) ? new Response('busy', { status: 503 }) : Response.json(openMeteoBody),
    ),
  );

  assert.ok(result.ok);
  assert.equal(result.data[0]?.provider, 'open-meteo');
});

void test('photon timing out falls back to open-meteo', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });

  const search = searchPlaces('Ben Nevis', (input, init) => {
    if (!isPhoton(input)) {
      return Promise.resolve(Response.json(openMeteoBody));
    }

    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('Timed out', 'TimeoutError'));
      });
      context.mock.timers.tick(5000);
    });
  });
  const result = await search;

  assert.ok(result.ok);
  assert.equal(result.data[0]?.provider, 'open-meteo');
});

void test('a caller abort rejects without trying open-meteo', async () => {
  const controller = new AbortController();
  const requested: string[] = [];

  const search = searchPlaces(
    'Ben Nevis',
    (input) => {
      requested.push(input instanceof Request ? input.url : input.toString());
      controller.abort();

      return Promise.reject(new DOMException('Aborted', 'AbortError'));
    },
    controller.signal,
  );

  await assert.rejects(search);
  assert.equal(requested.length, 1);
});

void test('both providers failing is a retryable error', async () => {
  const result = await searchPlaces('Ben Nevis', () => Promise.reject(new TypeError('offline')));

  assert.ok(!result.ok);
  assert.equal(result.error.code, 'PLACE_SEARCH_FAILED');
  assert.equal(result.error.retryable, true);
});
