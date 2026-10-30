import assert from 'node:assert/strict';
import test from 'node:test';
import type { RouteAnalysisOutcome } from '../route-analysis';
import {
  countRoutePointsInside,
  describeRoute,
  describeRouteSummary,
  formatRouteElevation,
  listRouteSummaryParts,
  projectRouteToFrame,
} from './route-overlay';
import type { WorkspaceRoute } from './controller';

const terrain = { location: { latitude: 55, longitude: -8 }, spanKm: 10 };
const route: WorkspaceRoute = {
  active: {
    id: 'imported-test',
    name: 'Ridge walk',
    provenance: 'imported',
    waypoints: [
      { latitude: 55, longitude: -8 },
      { latitude: 56, longitude: -8 },
    ],
    namedWaypoints: [{ name: 'Hut', latitude: 55, longitude: -8 }],
    slopeThresholdPercent: 15,
  },
  editing: { mode: 'viewing' },
  stats: { distanceKm: 6.24, ascentMeters: 130.4, descentMeters: 90, recordedPointCount: 40 },
  isVisible: true,
};

void test('the terrain centre projects to the frame centre and north is up', () => {
  const projected = projectRouteToFrame(route.active, terrain, { width: 800, height: 600 });

  assert.ok(projected);
  assert.deepEqual(projected.points[0], { x: 400, y: 300 });
  assert.ok(projected.points[1].y < 0);
  assert.equal(projected.waypoints[0].name, 'Hut');
});

void test('a terrain without a location projects nothing', () => {
  assert.equal(projectRouteToFrame(route.active, {}, { width: 800, height: 600 }), undefined);
});

void test('only points inside the loaded patch are counted', () => {
  assert.equal(countRoutePointsInside(route.active.waypoints, terrain), 1);
});

void test('the summary lists distance, climb and waypoints', () => {
  assert.equal(
    describeRoute(route),
    'Ridge walk · 6.2 km · ascent 130 m · descent 90 m · 1 waypoint',
  );
});

const complete: RouteAnalysisOutcome = {
  kind: 'analysed',
  analysis: {
    groundMeters: 100,
    surfaceMeters: 125,
    ascentMeters: 75,
    descentMeters: 55,
    netMeters: 20,
    isPartial: false,
    samples: [],
    steepSections: [],
  },
};

void test('a fully covered route shows ground, surface, ascent, descent and signed net (REQ-20, 21, 32)', () => {
  assert.deepEqual(describeRouteSummary(complete, 'drawn'), {
    status: 'ready',
    ground: '100 m',
    surface: '125 m',
    ascent: '75 m',
    descent: '55 m',
    net: '+20 m',
    isPartial: false,
    isTerrainDerived: false,
  });
});

void test('a negative net keeps its minus sign and zero has none', () => {
  assert.equal(formatRouteElevation(-12.4, true), '-12 m');
  assert.equal(formatRouteElevation(0.2, true), '0 m');
});

void test('a partial route hides surface length and is marked Partial (REQ-22)', () => {
  const partial: RouteAnalysisOutcome = {
    kind: 'analysed',
    analysis: { ...complete.analysis, isPartial: true },
  };

  assert.deepEqual(listRouteSummaryParts(describeRouteSummary(partial, 'drawn')), [
    '100 m ground',
    'ascent 75 m',
    'descent 55 m',
    'net +20 m',
    'Partial',
  ]);
});

void test('an imported route is labelled Terrain-derived (REQ-33)', () => {
  const parts = listRouteSummaryParts(describeRouteSummary(complete, 'imported'));

  assert.equal(parts.at(-1), 'Terrain-derived');
});

void test('a route without elevation coverage reports ground distance only', () => {
  const flat: RouteAnalysisOutcome = {
    kind: 'analysed',
    analysis: { groundMeters: 2400, isPartial: false, samples: [], steepSections: [] },
  };

  assert.deepEqual(listRouteSummaryParts(describeRouteSummary(flat, 'drawn')), ['2.4 km ground']);
});

void test('fewer than two points is an incomplete route, not a profile (REQ-38)', () => {
  const summary = describeRouteSummary({ kind: 'incomplete', pointCount: 1 }, 'drawn');

  assert.equal(summary.status, 'incomplete');
  assert.deepEqual(listRouteSummaryParts(summary), ['Incomplete route']);
});

void test('the one-line description uses terrain figures when analysed', () => {
  assert.equal(
    describeRoute(route, complete),
    'Ridge walk · 100 m ground · 125 m surface · ascent 75 m · descent 55 m · net +20 m · Terrain-derived · 1 waypoint',
  );
});
