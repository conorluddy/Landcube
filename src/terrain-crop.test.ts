import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addCropPolygonCorner,
  clampToCropFootprint,
  createRegularCropPolygon,
  isStarShapedCropPolygon,
  removeCropPolygonCorner,
  clipCirclePolygon,
  clipCircleSegment,
  clipFootprintSegment,
  getCropFootprint,
  getTerrainCropBounds,
  isInsideCropFootprint,
  normalizeRotationDegrees,
  sourceToCropPoint,
} from './terrain-crop';

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

void test('segments crossing a notched polygon split into the pieces on the model', () => {
  const footprint = getCropFootprint(
    'polygon',
    [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.4 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
    10,
    10,
  );
  const pieces = clipFootprintSegment({ x: -1, y: 2 }, { x: 11, y: 2 }, footprint);

  assert.equal(pieces.length, 2);
  assert.ok(Math.abs(pieces[0][0].x) < 1e-9);
  assert.ok(Math.abs(pieces[1][1].x - 10) < 1e-9);
  assert.ok(!isInsideCropFootprint({ x: 5, y: 2 }, footprint));
  assert.ok(isInsideCropFootprint({ x: 5, y: 6 }, footprint));
  assert.deepEqual(clampToCropFootprint({ x: 5, y: 12 }, footprint), { x: 5, y: 10 });
});

void test('crop points follow a rotated frame back to its unrotated box', () => {
  const crop = { x: 0, y: 0, width: 10, height: 10, rotationRadians: Math.PI / 2 };
  const point = sourceToCropPoint(crop, { x: 5, y: 0 });

  assert.ok(Math.abs(point.x) < 1e-9 && Math.abs(point.y - 5) < 1e-9);
  assert.equal(normalizeRotationDegrees(540), 180);
  assert.equal(normalizeRotationDegrees(-190), 170);
});

void test('even polygons fill the crop box and stay printable at every side count', () => {
  for (let sides = 3; sides <= 12; sides++) {
    const polygon = createRegularCropPolygon(sides);

    assert.equal(polygon.length, sides);
    assert.ok(isStarShapedCropPolygon(polygon));
    assert.ok(Math.abs(Math.min(...polygon.map((p) => p.x))) < 1e-9);
    assert.ok(Math.abs(Math.max(...polygon.map((p) => p.y)) - 1) < 1e-9);
  }
});

void test('stepping sides keeps edits: adding splits an edge, removing drops the flattest corner', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
  const five = addCropPolygonCorner(square);

  assert.deepEqual(five[1], { x: 0.5, y: 0 });
  assert.deepEqual(removeCropPolygonCorner(five), square);
  assert.equal(removeCropPolygonCorner(createRegularCropPolygon(3)), undefined);
});
