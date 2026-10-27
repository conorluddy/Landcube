import assert from 'node:assert/strict';
import test from 'node:test';
import {
  maximumGrassTufts,
  placeGrass,
  type GrassInstances,
  type GrassSite,
} from './grass-placement';
import { defaultGrassStyle } from './constants/grass';
import type { HeightField } from './types/terrain';

/** A gentle tilt, 2 m per frame unit horizontally at 10 m per frame unit: about 11° everywhere. */
function createField(slopePerUnit = 0.002, columns = 101, rows = 101): HeightField {
  return {
    columns,
    rows,
    originX: 0,
    originY: 0,
    spacing: 5,
    values: Float64Array.from(
      { length: columns * rows },
      (_, index) => (index % columns) * 5 * slopePerUnit,
    ),
  };
}

function createSite(overrides: Partial<GrassSite> = {}): GrassSite {
  return {
    field: createField(),
    width: 500,
    height: 500,
    shape: 'rectangle',
    originX: 0,
    originY: 0,
    frameUnitsPerMm: 4,
    metersPerFieldUnit: 1000,
    metersPerFrameUnit: 10,
    roads: [],
    ...overrides,
  };
}

const style = { ...defaultGrassStyle, coverage: 1, altitudeLimit: 1 };

function sourcePositions(instances: GrassInstances, originX = 0, originY = 0): Set<string> {
  return new Set(
    Array.from(
      { length: instances.count },
      (_, index) =>
        `${(instances.x[index] + originX).toFixed(3)},${(instances.y[index] + originY).toFixed(3)}`,
    ),
  );
}

/** Positions are Float32, so re-adding a crop offset can shift the last digit; match within 0.001. */
function hasTuftNear(instances: GrassInstances, x: number, y: number): boolean {
  for (let index = 0; index < instances.count; index++) {
    if (Math.abs(instances.x[index] - x) < 1e-3 && Math.abs(instances.y[index] - y) < 1e-3) {
      return true;
    }
  }

  return false;
}

void test('the same site and style always place the same tufts', () => {
  const first = placeGrass(createSite(), style);
  const second = placeGrass(createSite(), style);

  assert.ok(first.count > 1000);
  assert.deepEqual(sourcePositions(first), sourcePositions(second));
});

void test('raising density only adds tufts; every existing tuft stays put', () => {
  const sparse = sourcePositions(placeGrass(createSite(), { ...style, density: 40 }));
  const dense = sourcePositions(placeGrass(createSite(), { ...style, density: 160 }));

  assert.ok(dense.size > sparse.size * 2);

  for (const position of sparse) {
    assert.ok(dense.has(position), `${position} moved or vanished`);
  }
});

void test('moving the crop reveals or hides tufts but never moves them', () => {
  const field = createField();
  const whole = placeGrass(createSite({ field }), style);
  const shiftedField = { ...field, originX: field.originX - 100, originY: field.originY - 60 };
  const cropped = placeGrass(
    createSite({ field: shiftedField, width: 300, height: 300, originX: 100, originY: 60 }),
    style,
  );

  assert.ok(cropped.count > 0);

  // Every 50th tuft keeps the check quick; any moved tuft would still fail it.
  for (let index = 0; index < cropped.count; index += 50) {
    const x = cropped.x[index] + 100;
    const y = cropped.y[index] + 60;

    assert.ok(hasTuftNear(whole, x, y), `${x},${y} is not where the uncropped tuft was`);
  }
});

void test('grass keeps off roads and out of the sea', () => {
  const road = {
    points: [
      { x: 0, y: 250 },
      { x: 500, y: 250 },
    ],
    halfWidth: 8,
  };
  const withRoad = placeGrass(createSite({ roads: [road] }), style);

  for (let index = 0; index < withRoad.count; index++) {
    assert.ok(Math.abs(withRoad.y[index] - 250) >= 8, 'a tuft grows on the road');
  }

  // The field rises 0.002 a unit from 0 in the west, so a sea level of 0.25 floods x < 125.
  const coastal = placeGrass(createSite({ seaLevel: 0.25 }), style);

  assert.ok(coastal.count > 0);

  for (let index = 0; index < coastal.count; index++) {
    assert.ok(coastal.x[index] >= 125, `a tuft grows in the sea at x=${coastal.x[index]}`);
  }
});

void test('slope limits use the real slope, so steep ground stays bare', () => {
  // 0.02 field units per frame unit is 20 m rise per 10 m run: about 63°.
  const cliff = placeGrass(createSite({ field: createField(0.02) }), {
    ...style,
    slopeLimitDegrees: 35,
  });
  const gentle = placeGrass(createSite(), { ...style, slopeLimitDegrees: 35 });

  assert.equal(cliff.count, 0);
  assert.ok(gentle.count > 0);
});

void test('the tuft cap thins density evenly instead of leaving the far side bare', () => {
  const crowded = placeGrass(createSite({ frameUnitsPerMm: 1 }), { ...style, density: 200 });
  let farHalf = 0;

  for (let index = 0; index < crowded.count; index++) {
    farHalf += crowded.y[index] > 250 ? 1 : 0;
  }

  assert.ok(crowded.count <= maximumGrassTufts);
  assert.ok(farHalf > crowded.count * 0.4, `only ${farHalf} of ${crowded.count} in the far half`);
});
