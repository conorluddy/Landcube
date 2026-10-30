import assert from 'node:assert/strict';
import test from 'node:test';
import { describeRoute, countRoutePointsInside, projectRouteToFrame } from './route-overlay';
import type { WorkspaceRoute } from './controller';

const terrain = { location: { latitude: 55, longitude: -8 }, spanKm: 10 };
const route: WorkspaceRoute = {
  name: 'Ridge walk',
  points: [
    { latitude: 55, longitude: -8 },
    { latitude: 56, longitude: -8 },
  ],
  waypoints: [{ name: 'Hut', latitude: 55, longitude: -8 }],
  stats: { distanceKm: 6.24, ascentMeters: 130.4, descentMeters: 90, recordedPointCount: 40 },
  isVisible: true,
};

void test('the terrain centre projects to the frame centre and north is up', () => {
  const projected = projectRouteToFrame(route, terrain, { width: 800, height: 600 });

  assert.ok(projected);
  assert.deepEqual(projected.points[0], { x: 400, y: 300 });
  assert.ok(projected.points[1].y < 0);
  assert.equal(projected.waypoints[0].name, 'Hut');
});

void test('a terrain without a location projects nothing', () => {
  assert.equal(projectRouteToFrame(route, {}, { width: 800, height: 600 }), undefined);
});

void test('only points inside the loaded patch are counted', () => {
  assert.equal(countRoutePointsInside(route.points, terrain), 1);
});

void test('the summary lists distance, climb and waypoints', () => {
  assert.equal(
    describeRoute(route),
    'Ridge walk · 6.2 km · ascent 130 m · descent 90 m · 1 waypoint',
  );
});
