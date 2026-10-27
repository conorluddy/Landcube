import assert from 'node:assert/strict';
import test from 'node:test';
import { placeRocks, rockShapeCount, type RockInstances } from './rock-placement';
import { defaultRockStyle } from './constants/rocks';
import type { DecorationSite } from './decoration-field';
import type { HeightField } from './types/terrain';

/** A steady tilt rising east; 0.002 field units per frame unit is 2 m rise per 10 m, about 11°. */
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

function createSite(overrides: Partial<DecorationSite> = {}): DecorationSite {
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

const style = { ...defaultRockStyle, rocksPerSquareCm: 8 };

function sourcePoints(rocks: RockInstances, originX = 0, originY = 0) {
  return Array.from({ length: rocks.count }, (_, index) => ({
    x: rocks.x[index] + originX,
    y: rocks.y[index] + originY,
  }));
}

/** Positions are Float32, so re-adding a crop offset can shift the last digit. */
function hasRockNear(points: readonly { x: number; y: number }[], x: number, y: number): boolean {
  return points.some((point) => Math.abs(point.x - x) < 1e-3 && Math.abs(point.y - y) < 1e-3);
}

void test('the same site and style always place the same rocks', () => {
  const first = placeRocks(createSite(), style);

  assert.ok(first.count > 100);
  assert.deepEqual(placeRocks(createSite(), style), first);
});

void test('raising density only adds rocks', () => {
  const sparse = sourcePoints(placeRocks(createSite(), { ...style, rocksPerSquareCm: 3 }));
  const dense = sourcePoints(placeRocks(createSite(), style));

  assert.ok(dense.length > sparse.length);

  for (const point of sparse) {
    assert.ok(hasRockNear(dense, point.x, point.y), `${point.x},${point.y} moved or vanished`);
  }
});

void test('rocks are anchored to the source, so cropping only reveals or hides them', () => {
  // Flat ground keeps slope and altitude identical in both fields.
  const flat = createField(0, 201, 201);
  const whole = sourcePoints(
    placeRocks(createSite({ field: flat, width: 1000, height: 1000 }), style),
  );
  const crop = { x: 300, y: 200, size: 400 };
  const cropped = sourcePoints(
    placeRocks(
      createSite({
        field: createField(0, 81, 81),
        width: crop.size,
        height: crop.size,
        originX: crop.x,
        originY: crop.y,
      }),
      style,
    ),
    crop.x,
    crop.y,
  );
  const insideCrop = whole.filter(
    (point) =>
      point.x >= crop.x &&
      point.x <= crop.x + crop.size &&
      point.y >= crop.y &&
      point.y <= crop.y + crop.size,
  );

  assert.ok(cropped.length > 20);
  assert.equal(cropped.length, insideCrop.length);

  for (const point of cropped) {
    assert.ok(hasRockNear(insideCrop, point.x, point.y), `${point.x},${point.y} is not uncropped`);
  }
});

void test('rocks keep off roads, by the road and their own size, and out of the sea', () => {
  const road = {
    points: [
      { x: 0, y: 250 },
      { x: 500, y: 250 },
    ],
    halfWidth: 8,
  };
  const site = createSite({ roads: [road] });
  const withRoad = placeRocks(site, style);
  const largestRadius = (style.maximumSizeMm / 2) * site.frameUnitsPerMm;

  for (let index = 0; index < withRoad.count; index++) {
    assert.ok(
      Math.abs(withRoad.y[index] - 250) >= road.halfWidth * 1.4 + largestRadius - 1e-3,
      'a rock overlaps the road',
    );
  }

  // The field rises 0.002 a unit from 0 in the west, so a sea level of 0.25 floods x < 125.
  const coastal = placeRocks(createSite({ seaLevel: 0.25 }), style);

  assert.ok(coastal.count > 0);

  for (let index = 0; index < coastal.count; index++) {
    assert.ok(coastal.x[index] >= 125, `a rock sits in the sea at x=${coastal.x[index]}`);
  }
});

void test('sizes stay in range, shapes in the bank, and most rocks are small', () => {
  const rocks = placeRocks(createSite(), style);
  let small = 0;

  for (let index = 0; index < rocks.count; index++) {
    assert.ok(rocks.sizeMm[index] >= style.minimumSizeMm - 1e-6);
    assert.ok(rocks.sizeMm[index] <= style.maximumSizeMm + 1e-6);
    assert.ok(rocks.shape[index] < rockShapeCount);
    small += rocks.sizeMm[index] < (style.minimumSizeMm + style.maximumSizeMm) / 2 ? 1 : 0;
  }

  assert.ok(small > rocks.count * 0.6, `only ${small} of ${rocks.count} are small`);
});

void test('slope preference gathers rocks on steep ground', () => {
  const preferring = { ...style, slopePreference: 1 };
  // 0.0058 field units per frame unit is about 30°; 0.00087 is about 5°.
  const steep = placeRocks(createSite({ field: createField(0.0058) }), preferring);
  const gentle = placeRocks(createSite({ field: createField(0.00087) }), preferring);

  assert.ok(steep.count > gentle.count * 1.5, `${steep.count} steep vs ${gentle.count} gentle`);
});
