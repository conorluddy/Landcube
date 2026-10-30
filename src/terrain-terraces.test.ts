import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTerrainModel, defaultTerrainModelSettings } from './terrain-model';
import { createTerraceHeightSampler } from './terrain-terraces';
import { terrain3dElevationScale } from './terrain-surface';
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

void test('the terrace sampler returns the shelf vertex height at every surface vertex', () => {
  for (const cropShape of ['rectangle', 'circle'] as const) {
    const model = createTerrainModel(
      field,
      80,
      80,
      { ...defaultTerrainModelSettings, cropShape, terrainShape: 'terraced' },
      0.3,
      { origin: 0, interval: 0.15 },
    );
    const sample = createTerraceHeightSampler(model.surface);
    const shelfHeights = new Map<string, { x: number; z: number; heights: Set<number> }>();
    const { positions, indices } = model.surface;

    for (let i = 0; i < indices.length; i += 3) {
      const ids = Array.from(indices.subarray(i, i + 3));

      // Risers join two shelf heights; only shelves carry a single displayed height.
      if (ids.some((id) => positions[id * 3 + 1] !== positions[ids[0] * 3 + 1])) {
        continue;
      }

      for (const id of ids) {
        const [x, y, z] = positions.subarray(id * 3, id * 3 + 3);
        const entry = shelfHeights.get(`${x}:${z}`) ?? { x, z, heights: new Set<number>() };

        entry.heights.add(y);
        shelfHeights.set(`${x}:${z}`, entry);
      }
    }

    // Source grid vertices sit on one shelf (the band tie-break keeps them off levels); level
    // crossings sit on a riser line and resolve to its upper shelf.
    const single = [...shelfHeights.values()].filter(({ heights }) => heights.size === 1);

    assert.ok(single.length > 50, `${cropShape} grid vertices`);

    for (const { x, z, heights } of shelfHeights.values()) {
      assert.equal(sample(x, z), Math.max(...heights), `${cropShape} vertex at ${x}, ${z}`);
    }
  }
});

void test('between grid vertices the sampler lies on the step face of the quantised slope', () => {
  // A plane rising along x, so the source triangles interpolate it exactly.
  const ramp: HeightField = {
    columns: 9,
    rows: 9,
    originX: 0,
    originY: 0,
    spacing: 10,
    values: Float64Array.from({ length: 81 }, (_, i) => (i % 9) * 0.1),
  };
  const levels = { origin: 0.02, interval: 0.15 };
  const model = createTerrainModel(
    ramp,
    80,
    80,
    { ...defaultTerrainModelSettings, terrainShape: 'terraced' },
    0.5,
    levels,
  );
  const sample = createTerraceHeightSampler(model.surface);
  const mmPerUnit = defaultTerrainModelSettings.widthMm / 2;
  let steps = 0;
  let previous: number | undefined;

  for (let x = 0.5; x < 80; x += 0.73) {
    const value = (x / 10) * 0.1;
    const band = (value - levels.origin) / levels.interval;

    if (Math.abs(band - Math.round(band)) < 1e-3) {
      continue;
    }

    const shelf = levels.origin + Math.floor(band) * levels.interval;
    const expected =
      model.elevationOffsetMm + shelf * terrain3dElevationScale * model.elevationScaleMm;
    const height = sample(((x - 40) / 40) * mmPerUnit, 13.7);

    assert.ok(height !== undefined);
    assert.ok(Math.abs(height - expected) < 1e-4, `x ${x}: ${height} vs ${expected}`);
    steps += previous !== undefined && height !== previous ? 1 : 0;
    previous = height;
  }

  assert.ok(steps >= 4);
});

void test('the terrace sampler resolves a riser line to the upper shelf and misses off the model', () => {
  const model = createTerrainModel(
    {
      columns: 2,
      rows: 2,
      originX: 0,
      originY: 0,
      spacing: 10,
      values: Float64Array.from([0, 1, 0, 1]),
    },
    10,
    10,
    { ...defaultTerrainModelSettings, terrainShape: 'terraced' },
    0.3,
    { origin: 0, interval: 0.4 },
  );
  const sample = createTerraceHeightSampler(model.surface);
  const riserX = model.contourEdges?.[0]?.a.x ?? Number.NaN;
  const before = sample(riserX - 0.5, 0) ?? Number.NaN;
  const after = sample(riserX + 0.5, 0) ?? Number.NaN;

  assert.ok(after > before);
  assert.equal(sample(riserX, 0), after);
  assert.equal(sample(1000, 0), undefined);
});
