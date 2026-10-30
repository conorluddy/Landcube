import assert from 'node:assert/strict';
import test from 'node:test';
import { getFrameMetersPerPixel, locateModelFraction, locateViewportPoint } from './hud-location';

const frame = { width: 1000, height: 500 };
const placement = { location: { latitude: 55.0343, longitude: -8.113 }, spanKm: 8 };

void test('the 2D viewport centre locates to the real terrain location', () => {
  const location = locateViewportPoint({ x: 500, y: 250 }, frame, placement);

  assert.equal(location.kind, 'geographic');
  assert.ok(Math.abs(location.latitude - 55.0343) < 1e-9);
  assert.ok(Math.abs(location.longitude - -8.113) < 1e-9);
});

void test('generated terrain locates in metres on its nominal 10 km square', () => {
  assert.deepEqual(locateViewportPoint({ x: 250, y: 100 }, frame, undefined), {
    kind: 'local',
    eastMeters: 2500,
    southMeters: 1000,
  });
});

void test('a 3D model fraction interpolates the model bounds from the north-west corner', () => {
  assert.deepEqual(
    locateModelFraction(
      { x: 0.25, y: 0.5 },
      { kind: 'geographic', bounds: { north: 56, south: 54, west: -9, east: -7 } },
    ),
    { kind: 'geographic', latitude: 55, longitude: -8.5 },
  );
});

void test('a generated 3D model fraction offsets by its crop of the frame', () => {
  assert.deepEqual(
    locateModelFraction(
      { x: 0.5, y: 0 },
      { kind: 'generated', crop: { x: 100, y: 50, width: 200, height: 100 }, frame },
    ),
    { kind: 'local', eastMeters: 2000, southMeters: 500 },
  );
});

void test('the real span covers the frame’s longer side', () => {
  assert.equal(getFrameMetersPerPixel(frame, placement), 8);
  assert.equal(getFrameMetersPerPixel(frame, undefined), 10);
});
