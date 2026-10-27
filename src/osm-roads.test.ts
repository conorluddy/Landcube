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

void test('a malformed response fails with a retryable map-data error', () => {
  const result = parseOverpassRoads({ remark: 'runtime error' }, 'all', '');

  assert.deepEqual(result.ok ? undefined : result.error.code, 'MAP_DATA_FAILED');
});

void test('busy and unreachable road services return actionable errors instead of throwing', async () => {
  const busy = await loadMappedRoads(bounds, 'all', () =>
    Promise.resolve(new Response('', { status: 429 })),
  );
  const offline = await loadMappedRoads(bounds, 'all', () =>
    Promise.reject(new TypeError('Failed to fetch')),
  );

  assert.equal(!busy.ok && busy.error.message.includes('busy'), true);
  assert.equal(!offline.ok && offline.error.retryable, true);
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
