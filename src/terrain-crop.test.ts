import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clipCirclePolygon, clipCircleSegment, getTerrainCropBounds } from './terrain-crop';

void test('selection is constrained to the source, including resize limits', () => {
  const bounds = getTerrainCropBounds(1000, 800, 1, { centerX: -1, centerY: 3, size: 0.5 });

  assert.equal(bounds.width, 400);
  assert.equal(bounds.height, 400);
  assert.equal(bounds.x, 0);
  assert.equal(bounds.y, 400);
  assert.equal(
    getTerrainCropBounds(1000, 800, 1, { centerX: 0.5, centerY: 0.5, size: 2 }).width,
    800,
  );
});

void test('contours and water are confined to the circular footprint', () => {
  assert.deepEqual(clipCircleSegment({ x: -5, y: 5 }, { x: 15, y: 5 }, 10), [
    { x: 0, y: 5 },
    { x: 10, y: 5 },
  ]);
  assert.equal(clipCircleSegment({ x: -5, y: -5 }, { x: 15, y: -5 }, 10), undefined);
  assert.equal(clipCircleSegment({ x: 3, y: 3 }, { x: 3, y: 3 }, 10), undefined);
  const polygon = clipCirclePolygon(
    [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ],
    10,
  );

  assert.ok(polygon.length >= 100);

  for (const p of polygon) {
    assert.ok(Math.hypot(p.x - 5, p.y - 5) <= 5.000001);
  }

  assert.deepEqual(
    clipCirclePolygon(
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
      10,
    ),
    [],
  );
});
