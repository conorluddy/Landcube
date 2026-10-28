import assert from 'node:assert/strict';
import test from 'node:test';
import { createRockShape } from './rock-shapes';
import { defaultRockStyle } from './constants/rocks';

void test('rock shapes stand on the ground, one unit across, and repeat exactly', () => {
  for (let index = 0; index < 6; index++) {
    const shape = createRockShape(index, defaultRockStyle);
    const bounds = shape.boundingBox;

    assert.ok(bounds);
    assert.ok(Math.abs(bounds.min.y) < 1e-6);
    assert.ok(
      Math.abs(Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z) - 1) < 1e-6,
    );
    assert.deepEqual(
      createRockShape(index, defaultRockStyle).getAttribute('position').array,
      shape.getAttribute('position').array,
    );
  }
});

void test('flattening makes slabs and angularity changes the facets', () => {
  const chunky = createRockShape(0, { ...defaultRockStyle, flattening: 0 }).boundingBox;
  const slab = createRockShape(0, { ...defaultRockStyle, flattening: 1 }).boundingBox;

  assert.ok(chunky && slab);
  assert.ok(slab.max.y < chunky.max.y * 0.7);
  assert.notDeepEqual(
    createRockShape(0, { ...defaultRockStyle, angularity: 0 }).getAttribute('position').array,
    createRockShape(0, { ...defaultRockStyle, angularity: 1 }).getAttribute('position').array,
  );
});
