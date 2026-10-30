import assert from 'node:assert/strict';
import test from 'node:test';
import { createDisplayedSurface, createRouteRibbonBuffers } from './terrain-3d-route-drape';
import { createTerrainModel, defaultTerrainModelSettings } from './terrain-model';
import { sampleHeightField, terrain3dElevationScale } from './terrain-surface';
import type { HeightField } from './types/terrain';

// A slope rising along x and gently along y, so a diagonal route crosses many terraces.
const field: HeightField = {
  columns: 9,
  rows: 9,
  originX: 0,
  originY: 0,
  spacing: 10,
  values: Float64Array.from({ length: 81 }, (_, i) => (i % 9) * 0.1 + Math.floor(i / 9) * 0.02),
};
const exaggeration = 0.4;
const previewScale = 2 / defaultTerrainModelSettings.widthMm;
const route = [
  {
    roadClass: 'secondary' as const,
    points: [
      { x: 4, y: 6 },
      { x: 76, y: 70 },
    ],
  },
];

function createSurface(terrainShape: 'smooth' | 'terraced') {
  const modelSettings = { ...defaultTerrainModelSettings, terrainShape };
  const model = createTerrainModel(field, 80, 80, modelSettings, exaggeration, {
    origin: 0.01,
    interval: 0.12,
  });

  return createDisplayedSurface({
    field,
    width: 80,
    height: 80,
    modelSettings,
    exaggeration,
    elevationOffset: model.elevationOffsetMm * previewScale,
    terracedSurfaceMm: model.contourEdges ? model.surface : undefined,
  });
}

void test('the smooth surface height is the exaggerated height field above the base', () => {
  const surface = createSurface('smooth');
  const point = { x: 33, y: 41 };
  const zeroHeight = surface.heightAt({ x: 0, y: 0 }) ?? Number.NaN;

  assert.ok(
    Math.abs(
      (surface.heightAt(point) ?? Number.NaN) -
        zeroHeight -
        sampleHeightField(field, point.x, point.y) * terrain3dElevationScale * exaggeration,
    ) < 1e-9,
  );
  assert.equal(surface.heightAt({ x: -1, y: 40 }), undefined);
});

void test('the terraced surface height steps in whole layers', () => {
  const surface = createSurface('terraced');
  const layer = 0.12 * terrain3dElevationScale * exaggeration;
  const heights = [5, 25, 45, 65].map((x) => surface.heightAt({ x, y: 40 }) ?? Number.NaN);

  for (const height of heights.slice(1)) {
    const layers = (height - heights[0]) / layer;

    assert.ok(layers > 0.5 && Math.abs(layers - Math.round(layers)) < 1e-4, `${layers}`);
  }
});

for (const terrainShape of ['smooth', 'terraced'] as const) {
  void test(`a ${terrainShape} ribbon never dips below the displayed surface`, () => {
    const surface = createSurface(terrainShape);
    const lift = 0.0012;
    const { positions, pointCount } = createRouteRibbonBuffers(route, surface, 1.2, lift);
    const scale = 2 / 80;

    assert.ok(pointCount > 10);

    // Walk each edge of the ribbon finely, between as well as at its vertices.
    for (const side of [0, 1]) {
      for (let point = 0; point < pointCount - 1; point++) {
        const [a, b] = [point, point + 1].map((index) =>
          Array.from(positions.subarray((index * 2 + side) * 3, (index * 2 + side) * 3 + 3)),
        );

        for (let t = 0; t <= 1; t += 0.125) {
          const x = (a[0] + (b[0] - a[0]) * t) / scale + 40;
          const y = (a[2] + (b[2] - a[2]) * t) / scale + 40;
          const ribbon = a[1] + (b[1] - a[1]) * t;
          const ground = surface.heightAt({ x, y }) ?? -Infinity;

          assert.ok(ribbon >= ground + lift * 0.5, `${terrainShape} ${side} at ${x}, ${y}`);
        }
      }
    }
  });
}

void test('a terraced ribbon is level across its width and drops only at steps', () => {
  const surface = createSurface('terraced');
  const { positions, pointCount } = createRouteRibbonBuffers(route, surface, 1.2, 0.0012);
  let steps = 0;

  for (let point = 0; point < pointCount; point++) {
    assert.equal(positions[point * 6 + 1], positions[point * 6 + 4]);

    if (point > 0 && positions[point * 6 + 1] !== positions[point * 6 - 5]) {
      const run = Math.hypot(
        positions[point * 6] - positions[point * 6 - 6],
        positions[point * 6 + 2] - positions[point * 6 - 4],
      );

      // A thousandth of a cell, in preview units: risers, not ramps through the shelf above.
      assert.ok(run < (10 / 1000) * (2 / 80), `step run ${run}`);
      steps++;
    }
  }

  assert.ok(steps >= 4);
});
