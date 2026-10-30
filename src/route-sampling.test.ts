import assert from 'node:assert/strict';
import test from 'node:test';
import { maximumRouteSamples } from './constants/route-analysis';
import { locateRouteDistance, measureGroundMeters, sampleRoute } from './route-sampling';
import type { GeoPoint } from './types/terrain-analysis';

const metersPerDegreeLatitude = (6371008.8 * Math.PI) / 180;
const origin: GeoPoint = { latitude: 55, longitude: -8 };

function northOf(meters: number): GeoPoint {
  return {
    latitude: origin.latitude + meters / metersPerDegreeLatitude,
    longitude: origin.longitude,
  };
}

function intervalsOf(distances: readonly number[]): number[] {
  return distances.slice(1).map((distance, index) => distance - distances[index]);
}

void test('a degree of latitude measures about 111.2 km of ground', () => {
  const meters = measureGroundMeters({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 });

  assert.ok(Math.abs(meters - 111_195) < 1, `${meters}`);
});

void test('every waypoint is a sample at its exact position and distance', () => {
  const waypoints = [
    northOf(0),
    northOf(95),
    { latitude: northOf(95).latitude, longitude: -7.999 },
  ];
  const { samples, strategy } = sampleRoute(waypoints, 30);
  const waypointSamples = samples.filter(({ point }) =>
    waypoints.some(
      (waypoint) => waypoint.latitude === point.latitude && waypoint.longitude === point.longitude,
    ),
  );

  assert.equal(strategy, 'densified');
  assert.deepEqual(
    waypointSamples.map(({ point }) => point),
    waypoints,
  );
  assert.ok(Math.abs(waypointSamples[1].distanceMeters - 95) < 1e-6);
  assert.equal(samples[0].distanceMeters, 0);
});

void test('spacing is never finer than 10 m even over a 1 m source', () => {
  const { samples, spacingMeters } = sampleRoute([northOf(0), northOf(100)], 1);

  assert.equal(spacingMeters, 10);
  assert.equal(samples.length, 11);
});

void test('a coarse source sets the spacing and no interval exceeds it', () => {
  const { samples, spacingMeters } = sampleRoute([northOf(0), northOf(100), northOf(250)], 30);
  const intervals = intervalsOf(samples.map(({ distanceMeters }) => distanceMeters));

  assert.equal(spacingMeters, 30);
  assert.ok(intervals.every((interval) => interval <= 30 + 1e-9 && interval > 0));
});

void test('a long drawn route widens spacing to stay within the sample cap', () => {
  const waypoints = Array.from({ length: 40 }, (_, index) => northOf(index * 25_000));
  const { samples, spacingMeters } = sampleRoute(waypoints, 10);

  assert.ok(samples.length <= maximumRouteSamples, `${samples.length}`);
  assert.ok(samples.length > maximumRouteSamples * 0.9, `${samples.length}`);
  assert.ok(spacingMeters > 10);

  for (const waypoint of waypoints) {
    assert.ok(samples.some(({ point }) => point.latitude === waypoint.latitude));
  }
});

void test('an imported track over the cap is decimated over its original points', () => {
  const recordedPoints = Object.freeze(
    Array.from({ length: 25_000 }, (_, index) =>
      Object.freeze({ ...northOf(index * 4), elevationMeters: 120 }),
    ),
  );
  const { samples, strategy } = sampleRoute(recordedPoints, 30);
  const totalMeters = recordedPoints
    .slice(1)
    .reduce((sum, point, index) => sum + measureGroundMeters(recordedPoints[index], point), 0);

  assert.equal(strategy, 'decimated');
  assert.ok(samples.length <= maximumRouteSamples, `${samples.length}`);
  assert.deepEqual(samples[0].point, northOf(0));
  assert.deepEqual(samples[samples.length - 1].point, northOf(24_999 * 4));
  assert.ok(Math.abs(samples[samples.length - 1].distanceMeters - totalMeters) < 1e-6);
  assert.ok(samples.every(({ point }) => !('elevationMeters' in point)));
});

void test('a segment across the antimeridian is sampled the short way round', () => {
  const { samples } = sampleRoute(
    [
      { latitude: -17, longitude: 179.999 },
      { latitude: -17, longitude: -179.999 },
    ],
    10,
  );

  assert.ok(samples.length < 30, `${samples.length}`);
  assert.ok(
    samples.every(({ point }) => Math.abs(point.longitude) > 179.99),
    JSON.stringify(samples),
  );
});

void test('locating a distance lands on the profile sample at that distance', () => {
  const waypoints = [northOf(0), northOf(95), { latitude: 55.001, longitude: -7.998 }];
  const { samples } = sampleRoute(waypoints, 10);

  for (const { distanceMeters, point } of samples) {
    const located = locateRouteDistance(waypoints, distanceMeters);

    assert.ok(located);
    assert.ok(measureGroundMeters(located, point) < 1e-6, `at ${distanceMeters} m`);
  }
});

void test('locating a distance interpolates within a segment', () => {
  const located = locateRouteDistance([northOf(0), northOf(100)], 25);

  assert.ok(located);
  assert.ok(Math.abs(measureGroundMeters(origin, located) - 25) < 1e-6);
});

void test('distances beyond the route clamp to its ends', () => {
  const waypoints = [northOf(0), northOf(40), northOf(100)];

  assert.deepEqual(locateRouteDistance(waypoints, -5), waypoints[0]);
  assert.deepEqual(locateRouteDistance(waypoints, 1_000), waypoints[2]);
});

void test('a route with fewer than two points has nowhere to locate', () => {
  assert.equal(locateRouteDistance([], 0), undefined);
  assert.equal(locateRouteDistance([origin], 0), undefined);
});

void test('a non-finite distance is rejected', () => {
  assert.throws(() => locateRouteDistance([northOf(0), northOf(10)], Number.NaN), RangeError);
});
