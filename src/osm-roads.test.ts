import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createOverpassRoadQuery,
  getAvailableRoadDetail,
  loadMappedRoads,
  parseOverpassRoads,
} from './osm-roads';

const bounds = { north: 53.1, south: 53, west: -6.5, east: -6.3 };

function way(id: number, tags: Record<string, string>, points = 2) {
  return {
    type: 'way',
    id,
    tags,
    geometry: Array.from({ length: points }, (_, index) => ({
      lat: 53 + index * 0.01,
      lon: -6.4,
    })),
  };
}

void test('road queries cover the source bounds in Overpass south-west-north-east order', () => {
  const query = createOverpassRoadQuery(bounds, 'major');

  assert.match(query, /\(53\.000000,-6\.500000,53\.100000,-6\.300000\)/);
  assert.match(query, /\^\(motorway\|trunk\|primary\|secondary/);
  assert.doesNotMatch(query, /residential|track/);
  assert.match(createOverpassRoadQuery(bounds, 'tracks'), /\|track\)\$/);
});

void test('larger areas fetch major roads only, and very large ones none', () => {
  assert.equal(getAvailableRoadDetail(25), 'tracks');
  assert.equal(getAvailableRoadDetail(60), 'major');
  assert.equal(getAvailableRoadDetail(150), undefined);
});

void test('tunnels and bridges are counted and left out of drawn roads', () => {
  const result = parseOverpassRoads(
    {
      elements: [
        way(1, { highway: 'primary' }),
        way(2, { highway: 'primary', tunnel: 'yes' }),
        way(3, { highway: 'secondary', bridge: 'viaduct' }),
        way(4, { highway: 'tertiary', bridge: 'no' }),
        way(5, { highway: 'residential', covered: 'yes' }),
      ],
    },
    'all',
    '2026-10-27T00:00:00.000Z',
  );

  assert.ok(result.ok);
  assert.deepEqual(
    result.data.roads.map((road) => road.id),
    [1, 4],
  );
  assert.deepEqual(result.data.omitted, { tunnels: 2, bridges: 1 });
  assert.match(result.data.attribution, /OpenStreetMap contributors/);
});

void test('unknown classes, nodes and ways with invalid points are skipped rather than joined', () => {
  const broken = way(3, { highway: 'primary' }, 3);

  broken.geometry[1] = { lat: Number.NaN, lon: -6.4 };
  const result = parseOverpassRoads(
    {
      elements: [
        way(1, { highway: 'footway' }),
        { type: 'node', id: 2, lat: 53, lon: -6.4 },
        broken,
        way(4, { highway: 'track' }, 1),
      ],
    },
    'tracks',
    '',
  );

  assert.ok(result.ok);
  assert.equal(result.data.roads.length, 0);
});

void test('a partial response flagged with an Overpass remark fails instead of caching', () => {
  const result = parseOverpassRoads(
    {
      remark: 'runtime error: Query timed out in "query" at line 2 after 31 seconds.',
      elements: [way(1, { highway: 'primary' })],
    },
    'all',
    '',
  );

  assert.ok(!result.ok);
  assert.equal(result.error.retryable, true);
  assert.match(result.error.message, /could not finish/);
});

void test('responses without a readable stream are still parsed', async () => {
  const response = Response.json({ elements: [way(1, { highway: 'primary' })] });

  Object.defineProperty(response, 'body', { value: null });
  const result = await loadMappedRoads(bounds, 'all', () => Promise.resolve(response));

  assert.ok(result.ok);
  assert.equal(result.data.roads.length, 1);
});

void test('a malformed response fails with a retryable map-data error', () => {
  const result = parseOverpassRoads({ remark: 'runtime error' }, 'all', '');

  assert.deepEqual(result.ok ? undefined : result.error.code, 'MAP_DATA_FAILED');
});

void test('busy and unreachable road services return actionable errors instead of throwing', async () => {
  const busy = await loadMappedRoads(bounds, 'all', () =>
    Promise.resolve(new Response('', { status: 502 })),
  );
  const offline = await loadMappedRoads(bounds, 'all', () =>
    Promise.reject(new TypeError('Failed to fetch')),
  );

  assert.equal(!busy.ok && busy.error.message.includes('busy'), true);
  assert.equal(!offline.ok && offline.error.retryable, true);
});

void test('road downloads work without AbortSignal.any and forward the caller abort', async (t) => {
  // Safari before 17.4 has no AbortSignal.any.
  const descriptor = Object.getOwnPropertyDescriptor(AbortSignal, 'any');

  Reflect.deleteProperty(AbortSignal, 'any');
  t.after(() => {
    if (descriptor) {
      Object.defineProperty(AbortSignal, 'any', descriptor);
    }
  });
  const caller = new AbortController();
  let requestSignal: AbortSignal | undefined;
  const result = await loadMappedRoads(
    bounds,
    'all',
    (_url, init) => {
      requestSignal = init?.signal ?? undefined;

      return Promise.resolve(Response.json({ elements: [] }));
    },
    caller.signal,
  );

  assert.equal(result.ok, true);
  assert.equal(requestSignal?.aborted, false);

  const pending = loadMappedRoads(
    bounds,
    'all',
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      }),
    caller.signal,
  );

  caller.abort();
  await assert.rejects(pending, /Aborted/);
});

void test('road downloads post the query and record when they were fetched', async () => {
  let body = '';
  const result = await loadMappedRoads(
    bounds,
    'major',
    (_url, init) => {
      body = init?.body instanceof URLSearchParams ? init.body.toString() : '';

      return Promise.resolve(Response.json({ elements: [way(1, { highway: 'trunk' })] }));
    },
    undefined,
    () => new Date('2026-10-27T12:00:00Z'),
  );

  assert.ok(result.ok);
  assert.match(decodeURIComponent(body), /^data=\[out:json\]/);
  assert.equal(result.data.fetchedAt, '2026-10-27T12:00:00.000Z');
  assert.equal(result.data.detail, 'major');
});

void test('a source across the antimeridian queries one box on each side of it', () => {
  const query = createOverpassRoadQuery(
    { north: -16.9, south: -17.1, west: 179.9, east: 180.1 },
    'all',
  );

  assert.match(query, /\(-17\.100000,179\.900000,-16\.900000,180\.000000\)/);
  assert.match(query, /\(-17\.100000,-180\.000000,-16\.900000,-179\.900000\)/);
  assert.doesNotMatch(query, /180\.1/);
});

void test('oversized road responses fail without buffering the whole body', async () => {
  const megabyte = new Uint8Array(1024 * 1024).fill(32);
  let sentChunks = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      sentChunks++;
      controller.enqueue(megabyte);
    },
  });
  const streamed = await loadMappedRoads(bounds, 'all', () => Promise.resolve(new Response(body)));
  const declared = await loadMappedRoads(bounds, 'all', () =>
    Promise.resolve(
      new Response('{}', { headers: { 'content-length': String(64 * 1024 * 1024) } }),
    ),
  );

  for (const result of [streamed, declared]) {
    assert.ok(!result.ok);
    assert.match(result.error.message, /smaller area/);
    assert.equal(result.error.retryable, false);
  }

  assert.ok(sentChunks <= 22, `read ${sentChunks} MB`);
});
