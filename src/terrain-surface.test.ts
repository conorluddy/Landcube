import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  clipTerrainSegment,
  createTerrainSurfaceBuffers,
  sampleHeightField,
  terrain3dElevationScale,
} from './terrain-surface';
import type { HeightField } from './types/terrain';

const field: HeightField = {
  columns: 3,
  rows: 3,
  originX: -5,
  originY: -5,
  spacing: 10,
  values: new Float64Array([-1, 0, 1, 0, 1, 2, 1, 2, 3]),
};

void test('surface interpolation and frame vertices preserve the sampled elevation plane', () => {
  assert.equal(sampleHeightField(field, 0, 0), 0);
  assert.equal(sampleHeightField(field, 10, 10), 2);
  const { positions, indices } = createTerrainSurfaceBuffers(field, 10, 10);

  assert.equal(positions.length, 27);
  assert.equal(indices.length, 24);

  for (let offset = 0; offset < positions.length; offset += 3) {
    const x = positions[offset];
    const y = positions[offset + 1];
    const z = positions[offset + 2];

    assert.ok(x >= -1 && x <= 1 && z >= -1 && z <= 1);
    const expected = sampleHeightField(field, (x + 1) * 5, (z + 1) * 5) * terrain3dElevationScale;

    assert.ok(Math.abs(y - expected) < 1e-6);
  }

  for (let offset = 0; offset < indices.length; offset += 3) {
    const a = indices[offset] * 3;
    const b = indices[offset + 1] * 3;
    const c = indices[offset + 2] * 3;
    const upward =
      (positions[b + 2] - positions[a + 2]) * (positions[c] - positions[a]) -
      (positions[b] - positions[a]) * (positions[c + 2] - positions[a + 2]);

    assert.ok(upward > 0);
  }
});

void test('contours clip to the surface frame without connecting unrelated boundary endpoints', () => {
  assert.deepEqual(clipTerrainSegment({ x: -5, y: 5 }, { x: 15, y: 5 }, 10, 10), [
    { x: 0, y: 5 },
    { x: 10, y: 5 },
  ]);
  assert.equal(clipTerrainSegment({ x: -5, y: -5 }, { x: 15, y: -5 }, 10, 10), undefined);
  assert.equal(clipTerrainSegment({ x: -5, y: 5 }, { x: 5, y: 20 }, 10, 10), undefined);
});
