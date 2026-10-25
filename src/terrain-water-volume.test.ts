import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWaterVolume } from './terrain-water-volume';

void test('water closes only the outer cut edges and preserves the submerged floor', () => {
  const positions = [-1, -2, -1, 1, -2, -1, 1, -2, 1, -1, -2, 1];
  const water = createWaterVolume(positions, [0, 2, 1, 0, 3, 2], 0);

  assert.equal(water.top.length, 18);
  assert.equal(water.sides.length, 72); // Four quads; no internal diagonal wall.

  for (let i = 1; i < water.top.length; i += 3) {
    assert.equal(water.top[i], 0);
  }

  assert.equal(Math.min(...water.sides.filter((_, i) => i % 3 === 1)), -2);
  assert.deepEqual(createWaterVolume(positions, [0, 2, 1, 0, 3, 2], -3), { top: [], sides: [] });
});

void test('shoreline clips top and cut walls where terrain crosses the water level', () => {
  const water = createWaterVolume([-1, -1, -1, 1, 1, -1, -1, -1, 1], [0, 2, 1], 0);

  assert.equal(water.top.length, 18);

  for (let i = 1; i < water.sides.length; i += 3) {
    assert.ok(water.sides[i] <= 0);
  }

  assert.ok(water.top.includes(0));
});
