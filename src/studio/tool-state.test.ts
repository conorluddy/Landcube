import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultTerrainCrop } from '../terrain-crop';
import {
  bearingDegrees,
  distanceBetweenPlaces,
  formatBearing,
  formatDistance,
  getCropFractionBox,
  getNudgeDelta,
  resizeCrop,
} from './tool-state';

const squareModelOnWideFrame = { width: 1000, height: 500, aspectRatio: 1 };

void test('the default crop is the largest square centred on a wide frame', () => {
  assert.deepEqual(getCropFractionBox(defaultTerrainCrop, squareModelOnWideFrame), {
    x: 0.25,
    y: 0,
    width: 0.5,
    height: 1,
  });
});

void test('dragging the right edge inwards shrinks the crop and keeps the left edge', () => {
  const crop = resizeCrop(defaultTerrainCrop, 'right', { x: -0.1, y: 0 }, squareModelOnWideFrame);
  const box = getCropFractionBox(crop, squareModelOnWideFrame);

  assert.ok(Math.abs(crop.size - 0.8) < 1e-9);
  assert.ok(Math.abs(box.x - 0.25) < 1e-9);
  assert.ok(Math.abs(box.y - 0.1) < 1e-9);
});

void test('a crop never grows past the room on the source or the largest crop', () => {
  const small = { centerX: 0.5, centerY: 0.5, size: 0.5 };
  const grown = resizeCrop(small, 'left', { x: -1, y: 0 }, squareModelOnWideFrame);

  assert.equal(grown.size, 1);
  assert.equal(grown.centerY, 0.5);
});

void test('a crop never shrinks below the widget minimum of 10%', () => {
  const crop = resizeCrop(
    defaultTerrainCrop,
    'bottom-right',
    { x: -1, y: -1 },
    squareModelOnWideFrame,
  );

  assert.equal(crop.size, 0.1);
  assert.equal(getCropFractionBox(crop, squareModelOnWideFrame).x, 0.25);
});

void test('a corner keeps the opposite corner fixed', () => {
  const crop = resizeCrop(
    defaultTerrainCrop,
    'top-left',
    { x: 0.05, y: 0 },
    squareModelOnWideFrame,
  );
  const box = getCropFractionBox(crop, squareModelOnWideFrame);

  assert.ok(Math.abs(box.x + box.width - 0.75) < 1e-9);
  assert.ok(Math.abs(box.y + box.height - 1) < 1e-9);
});

void test('arrow keys nudge 1%, or 5% with Shift, and other keys do nothing', () => {
  assert.deepEqual(getNudgeDelta('ArrowRight', false), { x: 0.01, y: 0 });
  assert.deepEqual(getNudgeDelta('ArrowUp', true), { x: 0, y: -0.05 });
  assert.equal(getNudgeDelta('Enter', false), undefined);
});

void test('local distance and bearing use metres east and south', () => {
  const from = { kind: 'local', eastMeters: 0, southMeters: 1000 } as const;
  const to = { kind: 'local', eastMeters: 3000, southMeters: 5000 } as const;

  assert.equal(distanceBetweenPlaces(from, to), 5000);
  assert.ok(Math.abs((bearingDegrees(from, to) ?? 0) - 143.13) < 0.01);
  assert.equal(bearingDegrees(to, { ...to, southMeters: 0 }), 0);
});

void test('geographic distance is great-circle and bearing is clockwise from north', () => {
  const from = { kind: 'geographic', latitude: 0, longitude: 0 } as const;

  assert.ok(Math.abs((distanceBetweenPlaces(from, { ...from, longitude: 1 }) ?? 0) - 111_195) < 1);
  assert.ok(Math.abs((bearingDegrees(from, { ...from, longitude: 1 }) ?? 0) - 90) < 1e-9);
  assert.ok(Math.abs((bearingDegrees(from, { ...from, latitude: -1 }) ?? 0) - 180) < 1e-9);
});

void test('places of different kinds have no distance', () => {
  assert.equal(
    distanceBetweenPlaces(
      { kind: 'local', eastMeters: 0, southMeters: 0 },
      { kind: 'geographic', latitude: 0, longitude: 0 },
    ),
    undefined,
  );
});

void test('distances read in metres below a kilometre and bearings as three digits', () => {
  assert.equal(formatDistance(849.6), '850 m');
  assert.equal(formatDistance(3754), '3.75 km');
  assert.equal(formatDistance(12_340), '12.3 km');
  assert.equal(formatBearing(7.4), '007°');
  assert.equal(formatBearing(359.6), '000°');
});
