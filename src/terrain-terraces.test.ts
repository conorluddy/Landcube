import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTerrainModel, defaultTerrainModelSettings } from './terrain-model';
import { validatePrintableSolid, createBinaryStl } from './export/stl-export';
import type { HeightField } from './types/terrain';

const field: HeightField = {
  columns: 9,
  rows: 9,
  originX: 0,
  originY: 0,
  spacing: 10,
  values: Float64Array.from(
    { length: 81 },
    (_, i) => Math.sin(i % 9) * 0.5 + Math.cos(Math.floor(i / 9)) * 0.4,
  ),
};

for (const cropShape of ['rectangle', 'circle'] as const) {
  for (const exaggeration of [0, 0.3, 1]) {
    void test(`terraced ${cropShape} at ${exaggeration} has horizontal shelves, vertical risers and a closed STL`, () => {
      const model = createTerrainModel(
        field,
        80,
        80,
        { ...defaultTerrainModelSettings, cropShape, terrainShape: 'terraced' },
        exaggeration,
        { origin: 0, interval: 0.15 },
      );

      validatePrintableSolid(model.solid);
      assert.ok(createBinaryStl(model.solid).byteLength > 84);

      if (exaggeration === 0) {
        return;
      }

      let shelves = 0;
      let risers = 0;

      for (let i = 0; i < model.surface.indices.length; i += 3) {
        const [a, b, c] = Array.from(model.surface.indices.subarray(i, i + 3), (id) =>
          Array.from(model.surface.positions.subarray(id * 3, id * 3 + 3)),
        );
        const ab = b.map((v, axis) => v - a[axis]);
        const ac = c.map((v, axis) => v - a[axis]);
        const normal = [
          ab[1] * ac[2] - ab[2] * ac[1],
          ab[2] * ac[0] - ab[0] * ac[2],
          ab[0] * ac[1] - ab[1] * ac[0],
        ];

        if (a[1] === b[1] && b[1] === c[1]) {
          shelves++;
        } else {
          assert.ok(Math.abs(normal[1]) < 1e-8);
          risers++;
        }
      }

      assert.ok(shelves > 0);
      assert.ok(risers > 0);
      assert.ok(Math.abs((model.layerHeightMm ?? 0) - 0.15 * 0.65 * 75 * exaggeration) < 1e-6);
    });
  }
}

void test('terraces meeting exact contour vertices and flat plateaus stay watertight', () => {
  for (const values of [
    [0, 1, 2, 0, 1, 2, 0, 1, 2],
    [1, 1, 1, 0, 1, 2, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, -1, 1, -1, 0, -1, 1, -1, 1],
    [-1, 1, -1, 1, 0, 1, -1, 1, -1],
  ]) {
    const model = createTerrainModel(
      {
        columns: 3,
        rows: 3,
        originX: 0,
        originY: 0,
        spacing: 10,
        values: Float64Array.from(values),
      },
      20,
      20,
      { ...defaultTerrainModelSettings, terrainShape: 'terraced' },
      0.3,
      { origin: 0, interval: 1 },
    );

    validatePrintableSolid(model.solid);
  }
});

void test('terraced crops retain their dimensions across coarse and fine levels', () => {
  for (const cropShape of ['rectangle', 'circle'] as const) {
    for (const interval of [0.04, 0.3, 10]) {
      const settings = {
        ...defaultTerrainModelSettings,
        widthMm: 180,
        lengthMm: 90,
        cropShape,
        terrainShape: 'terraced' as const,
      };
      const model = createTerrainModel(field, 80, cropShape === 'circle' ? 80 : 40, settings, 0.3, {
        origin: 0.037,
        interval,
      });

      validatePrintableSolid(model.solid);
      assert.ok(model.overallHeightMm >= settings.baseThicknessMm);
      const xs = Array.from(model.solid.positions).filter((_, index) => index % 3 === 0);
      const ys = Array.from(model.solid.positions).filter((_, index) => index % 3 === 1);

      assert.equal(Math.max(...xs) - Math.min(...xs), 180);
      assert.equal(Math.min(...ys), 0);
    }
  }
});
