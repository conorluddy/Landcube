/*
 * Route analysis fixtures (resolves PRD OQ-2). Routes run due north from a fixed origin over
 * synthetic samplers whose elevation is a function of northward distance, so expected values
 * are exact. Tolerances:
 * - Distances (ground, terrain-following, steep-section bounds): within 0.5 m or 0.1%,
 *   whichever is larger.
 * - Elevation totals (ascent, descent, net): within 0.01 m.
 * - Grades: within 0.01 percentage points.
 * Latency budget: a capped (~10,000 sample) analysis in well under 50 ms on desktop; the test
 * asserts a 250 ms ceiling so slow CI and mobile-class hardware do not flake.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { performance } from 'node:perf_hooks';
import { defaultSlopeThresholdPercent, maximumRouteSamples } from './constants/route-analysis';
import {
  analyseRoute,
  createRouteAnalysisCache,
  validateSlopeThresholdPercent,
  type RouteAnalysisOutcome,
} from './route-analysis';
import type { RoutePoint } from './types/route';
import type {
  GeoPoint,
  RouteAnalysis,
  SourceElevationSampler,
  SteepSection,
} from './types/terrain-analysis';

const metersPerDegreeLatitude = (6371008.8 * Math.PI) / 180;
const origin: GeoPoint = { latitude: 55, longitude: -8 };
const options = { slopeThresholdPercent: defaultSlopeThresholdPercent };

function northOf(meters: number): GeoPoint {
  return {
    latitude: origin.latitude + meters / metersPerDegreeLatitude,
    longitude: origin.longitude,
  };
}

function createSampler(
  elevationAt: (northMeters: number) => number | undefined,
  revision = 'fixture',
): SourceElevationSampler {
  return {
    revision,
    resolutionMeters: 10,
    coverage: { north: 56, south: 54, east: -7, west: -9 },
    sampleMeters: ({ latitude }) =>
      elevationAt((latitude - origin.latitude) * metersPerDegreeLatitude),
  };
}

/** Piecewise-linear elevation through `[northMeters, elevationMeters]` knots. */
function createProfileSampler(knots: readonly [number, number][]): SourceElevationSampler {
  return createSampler((northMeters) => {
    const upper = knots.findIndex(([knotMeters]) => knotMeters >= northMeters);

    if (upper === -1) {
      return knots[knots.length - 1][1];
    }

    if (upper === 0) {
      return knots[0][1];
    }

    const [startMeters, startElevation] = knots[upper - 1];
    const [endMeters, endElevation] = knots[upper];

    return (
      startElevation +
      ((northMeters - startMeters) / (endMeters - startMeters)) * (endElevation - startElevation)
    );
  });
}

function analysed(outcome: RouteAnalysisOutcome): RouteAnalysis {
  assert.equal(outcome.kind, 'analysed');

  return outcome.analysis;
}

function assertDistance(actual: number | undefined, expected: number, label: string): void {
  assert.ok(actual !== undefined, `${label} is missing`);
  assert.ok(
    Math.abs(actual - expected) <= Math.max(0.5, expected * 0.001),
    `${label}: expected ${expected} m, got ${actual} m`,
  );
}

function assertElevation(actual: number | undefined, expected: number, label: string): void {
  assert.ok(actual !== undefined, `${label} is missing`);
  assert.ok(
    Math.abs(actual - expected) <= 0.01,
    `${label}: expected ${expected} m, got ${actual} m`,
  );
}

function assertSections(actual: readonly SteepSection[], expected: readonly SteepSection[]): void {
  assert.deepEqual(
    actual.map(({ direction }) => direction),
    expected.map(({ direction }) => direction),
  );
  actual.forEach((section, index) => {
    assertDistance(section.startMeters, expected[index].startMeters, `section ${index} start`);
    assertDistance(section.endMeters, expected[index].endMeters, `section ${index} end`);
  });
}

void test('zero or one point reports an incomplete route', () => {
  const sampler = createSampler(() => 0);

  assert.deepEqual(analyseRoute([], sampler, options), { kind: 'incomplete', pointCount: 0 });
  assert.deepEqual(analyseRoute([northOf(0)], sampler, options), {
    kind: 'incomplete',
    pointCount: 1,
  });
});

void test('two points report ground distance even without terrain', () => {
  const analysis = analysed(analyseRoute([northOf(0), northOf(1_000)], undefined, options));

  assertDistance(analysis.groundMeters, 1_000, 'ground');
  assert.equal(analysis.ascentMeters, undefined);
  assert.equal(analysis.surfaceMeters, undefined);
});

void test('a 100 m segment rising 75 m follows 125 m of terrain', () => {
  const analysis = analysed(
    analyseRoute(
      [northOf(0), northOf(100)],
      createSampler((meters) => meters * 0.75),
      options,
    ),
  );

  assertDistance(analysis.groundMeters, 100, 'ground');
  assertDistance(analysis.surfaceMeters, 125, 'surface');
  assert.equal(analysis.isPartial, false);
});

void test('elevations 100, 150, 120 give 50 m ascent, 30 m descent and +20 m net', () => {
  const sampler = createProfileSampler([
    [0, 100],
    [100, 150],
    [200, 120],
  ]);
  const analysis = analysed(
    analyseRoute([northOf(0), northOf(100), northOf(200)], sampler, options),
  );

  assertElevation(analysis.ascentMeters, 50, 'ascent');
  assertElevation(analysis.descentMeters, 30, 'descent');
  assertElevation(analysis.netMeters, 20, 'net');
});

void test('grades of +15% and -15% are steep at 15% while +10% is not', () => {
  const sampler = createProfileSampler([
    [0, 0],
    [200, 30],
    [400, 0],
    [600, 20],
  ]);
  const analysis = analysed(analyseRoute([northOf(0), northOf(600)], sampler, options));
  const gradeAt = (meters: number): number | undefined =>
    analysis.samples.find(({ distanceMeters }) => Math.abs(distanceMeters - meters) < 1e-6)
      ?.gradePercent;

  // A 50 m window over 10 m samples ends on samples 30 m either side; steep once clear of a knot.
  assertSections(analysis.steepSections, [
    { startMeters: 0, endMeters: 170, direction: 'climb' },
    { startMeters: 230, endMeters: 370, direction: 'descent' },
  ]);
  assert.ok(Math.abs((gradeAt(100) ?? NaN) - 15) <= 0.01);
  assert.ok(Math.abs((gradeAt(500) ?? NaN) - 10) <= 0.01);
});

void test('the slope threshold defaults to 15% and accepts 1% through 100%', () => {
  assert.equal(defaultSlopeThresholdPercent, 15);

  for (const value of [1, 15, 100]) {
    assert.deepEqual(validateSlopeThresholdPercent(value), { ok: true, data: value });
  }

  for (const value of [0.5, 100.5, Number.NaN]) {
    assert.equal(validateSlopeThresholdPercent(value).ok, false);
  }

  assert.throws(
    () => analyseRoute([northOf(0), northOf(10)], undefined, { slopeThresholdPercent: 0 }),
    RangeError,
  );
});

void test('reversing a route swaps ascent and descent and mirrors steep sections', () => {
  const sampler = createProfileSampler([
    [0, 100],
    [100, 150],
    [200, 120],
  ]);
  const points = [northOf(0), northOf(100), northOf(200)];
  const forward = analysed(analyseRoute(points, sampler, options));
  const reversed = analysed(analyseRoute([...points].reverse(), sampler, options));
  const mirrored = [...forward.steepSections]
    .reverse()
    .map(({ startMeters, endMeters, direction }): SteepSection => ({
      startMeters: forward.groundMeters - endMeters,
      endMeters: forward.groundMeters - startMeters,
      direction: direction === 'climb' ? 'descent' : 'climb',
    }));

  assertElevation(reversed.ascentMeters, 30, 'reversed ascent');
  assertElevation(reversed.descentMeters, 50, 'reversed descent');
  assertElevation(reversed.netMeters, -20, 'reversed net');
  assert.deepEqual(
    forward.steepSections.map(({ direction }) => direction),
    ['climb', 'descent'],
  );
  assertSections(reversed.steepSections, mirrored);
  assert.deepEqual(points, [northOf(0), northOf(100), northOf(200)]);
});

void test('an uncovered stretch leaves a gap and partial totals that exclude it', () => {
  const sampler = createSampler((meters) =>
    meters > 305 && meters < 495 ? undefined : meters * 0.1,
  );
  const analysis = analysed(analyseRoute([northOf(0), northOf(800)], sampler, options));
  const sampleAt = (meters: number) =>
    analysis.samples.find(({ distanceMeters }) => Math.abs(distanceMeters - meters) < 1e-6);

  assert.equal(analysis.isPartial, true);
  assert.equal(sampleAt(400)?.elevationMeters, undefined);
  assert.equal(sampleAt(300)?.gradePercent, undefined);
  assert.ok(Math.abs((sampleAt(270)?.gradePercent ?? NaN) - 10) <= 0.01);
  assertDistance(analysis.groundMeters, 800, 'ground');
  assertDistance(analysis.surfaceMeters, 600 * Math.hypot(1, 0.1), 'surface');
  assertElevation(analysis.ascentMeters, 60, 'ascent');
  assertElevation(analysis.descentMeters, 0, 'descent');
  assertElevation(analysis.netMeters, 80, 'net');
});

void test('a route with no coverage keeps ground distance and omits elevation totals', () => {
  const analysis = analysed(
    analyseRoute(
      [northOf(0), northOf(300)],
      createSampler(() => undefined),
      options,
    ),
  );

  assertDistance(analysis.groundMeters, 300, 'ground');
  assert.equal(analysis.isPartial, true);
  assert.deepEqual(
    [analysis.surfaceMeters, analysis.ascentMeters, analysis.descentMeters, analysis.netMeters],
    [undefined, undefined, undefined, undefined],
  );
  assert.deepEqual(analysis.steepSections, []);
});

void test('imported points are analysed against terrain and keep their recorded heights', () => {
  const recordedPoints: readonly RoutePoint[] = Object.freeze([
    Object.freeze({ ...northOf(0), elevationMeters: 120 }),
    Object.freeze({ ...northOf(200), elevationMeters: 120 }),
  ]);
  const analysis = analysed(
    analyseRoute(
      recordedPoints,
      createSampler(() => 100),
      options,
    ),
  );

  assert.ok(analysis.samples.every(({ elevationMeters }) => elevationMeters === 100));
  assert.equal(recordedPoints[0].elevationMeters, 120);
});

void test('the cache returns the same analysis until geometry, revision or threshold change', () => {
  const analyse = createRouteAnalysisCache();
  const sampler = createSampler((meters) => meters * 0.2);
  const first = analyse([northOf(0), northOf(500)], sampler, options);

  assert.equal(analyse([northOf(0), northOf(500)], sampler, options), first);
  assert.notEqual(analyse([northOf(0), northOf(501)], sampler, options), first);
  assert.notEqual(
    analyse(
      [northOf(0), northOf(500)],
      createSampler((meters) => meters * 0.2, 'other'),
      options,
    ),
    first,
  );
  assert.notEqual(
    analyse([northOf(0), northOf(500)], sampler, { slopeThresholdPercent: 20 }),
    first,
  );
});

void test('a long drawn route analyses within the sample cap and latency budget', () => {
  const waypoints = Array.from({ length: 200 }, (_, index) => ({
    ...northOf(index * 500),
    longitude: origin.longitude + (index % 2) * 0.002,
  }));
  const sampler = createSampler((meters) => 300 + 80 * Math.sin(meters / 400));
  const startedMs = performance.now();
  const analysis = analysed(analyseRoute(waypoints, sampler, options));
  const durationMs = performance.now() - startedMs;

  assert.ok(analysis.samples.length <= maximumRouteSamples, `${analysis.samples.length}`);
  assert.ok(durationMs < 250, `analysis took ${durationMs} ms`);
});

void test('an imported track over the cap analyses its full ground distance', () => {
  const recordedPoints = Array.from({ length: 30_000 }, (_, index) => northOf(index * 3));
  const analysis = analysed(
    analyseRoute(
      recordedPoints,
      createSampler((meters) => meters * 0.01),
      options,
    ),
  );

  assert.ok(analysis.samples.length <= maximumRouteSamples, `${analysis.samples.length}`);
  assertDistance(analysis.groundMeters, 29_999 * 3, 'ground');
  assertElevation(analysis.ascentMeters, 29_999 * 3 * 0.01, 'ascent');
});
