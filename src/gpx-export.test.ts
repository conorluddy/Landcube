import assert from 'node:assert/strict';
import test from 'node:test';
import { parseGpx } from './gpx';
import { getRouteGpxFilename, serializeRouteGpx } from './gpx-export';
import type { GpxRoute } from './types/route';
import type { ActiveRoute } from './types/terrain-analysis';

const drawn: ActiveRoute = {
  id: 'r1',
  name: 'Ridge',
  provenance: 'drawn',
  waypoints: [
    { latitude: 53.1, longitude: -6.1 },
    { latitude: 53.2, longitude: -6.2 },
    { latitude: 53.3, longitude: -6.3 },
  ],
  namedWaypoints: [{ name: 'Summit', latitude: 53.2, longitude: -6.2 }],
  slopeThresholdPercent: 15,
};

const imported: ActiveRoute = {
  ...drawn,
  provenance: 'imported',
  originalPoints: [
    { latitude: 53.1, longitude: -6.1, elevationMeters: 123.456789 },
    { latitude: 53.15, longitude: -6.15 },
    { latitude: 53.2, longitude: -6.2, elevationMeters: 0 },
  ],
};

function parse(text: string): GpxRoute {
  const result = parseGpx(text);

  assert.ok(result.ok, result.ok ? '' : result.error.message);

  return result.data;
}

void test('a drawn route round-trips points, order, name and waypoints', () => {
  const parsed = parse(serializeRouteGpx(drawn, () => 100.04));

  assert.equal(parsed.name, 'Ridge');
  assert.deepEqual(
    parsed.points.map(({ latitude, longitude }) => [latitude, longitude]),
    drawn.waypoints.map(({ latitude, longitude }) => [latitude, longitude]),
  );
  assert.deepEqual(parsed.waypoints, drawn.namedWaypoints);
  assert.ok(parsed.points.every((point) => point.elevationMeters === 100));
});

void test('a drawn route omits ele outside terrain coverage, never writing zero', () => {
  const parsed = parse(
    serializeRouteGpx(drawn, (point) => (point.latitude > 53.15 ? 50 : undefined)),
  );

  assert.deepEqual(
    parsed.points.map((point) => point.elevationMeters),
    [undefined, 50, 50],
  );
  assert.equal(serializeRouteGpx(drawn).includes('<ele>'), false);
});

void test('an imported route keeps recorded elevations exactly and ignores terrain', () => {
  let lookups = 0;
  const parsed = parse(
    serializeRouteGpx(imported, () => {
      lookups += 1;

      return 999;
    }),
  );

  assert.equal(lookups, 0);
  assert.deepEqual(
    parsed.points.map((point) => point.elevationMeters),
    [123.456789, undefined, 0],
  );
});

void test('names are escaped for XML', () => {
  const route = {
    ...drawn,
    name: `A&B <"x"> 'y'`,
    namedWaypoints: [{ name: '<&>', latitude: 1, longitude: 2 }],
  };
  const xml = serializeRouteGpx(route);

  assert.ok(xml.includes('A&amp;B &lt;&quot;x&quot;&gt; &apos;y&apos;'));
  assert.equal(parse(xml).waypoints[0]?.name, '<&>');
  assert.equal(parse(xml).name, `A&B <"x"> 'y'`);
});

void test('output is byte-identical across runs and carries no timestamps', () => {
  const first = serializeRouteGpx(drawn, () => 12.34);

  assert.equal(
    first,
    serializeRouteGpx(drawn, () => 12.34),
  );
  assert.equal(first.includes('<time>'), false);
  assert.ok(first.includes('creator="LANDCU.BE"'));
});

void test('a reversed route exports in reversed order', () => {
  const reversed = { ...drawn, waypoints: [...drawn.waypoints].reverse() };
  const parsed = parse(serializeRouteGpx(reversed));

  assert.deepEqual(
    parsed.points.map((point) => point.latitude),
    [53.3, 53.2, 53.1],
  );
});

void test('filenames are slugified with a fallback', () => {
  assert.equal(getRouteGpxFilename({ name: 'Wicklow Way: Día 1!' }), 'wicklow-way-dia-1.gpx');
  assert.equal(getRouteGpxFilename({ name: '***' }), 'route.gpx');
});
