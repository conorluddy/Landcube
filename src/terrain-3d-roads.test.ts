import assert from 'node:assert/strict';
import test from 'node:test';
import { createTerrainRoadLayer, type TerrainRoadInputs } from './terrain-3d-roads';
import { defaultRoadStyle } from './constants/roads';
import type { HeightField } from './types/terrain';

const field: HeightField = {
  columns: 11,
  rows: 11,
  originX: 0,
  originY: 0,
  spacing: 10,
  values: new Float64Array(121),
};
const inputs: TerrainRoadInputs = {
  paths: [
    {
      roadClass: 'primary',
      points: [
        { x: 10, y: 50 },
        { x: 90, y: 50 },
      ],
    },
  ],
  field,
  width: 100,
  height: 100,
  modelSettings: { widthMm: 150, lengthMm: 150, baseThicknessMm: 3 },
  exaggeration: 0.3,
  elevationOffset: 0,
};
const enabled = { ...defaultRoadStyle, enabled: true };

void test('colour and texture edits keep the road geometry; width edits rebuild it', () => {
  const layer = createTerrainRoadLayer();

  layer.update(inputs);
  layer.setStyle(enabled);
  const built = layer.mesh.geometry;

  assert.ok((built.index?.count ?? 0) > 0);
  assert.equal(layer.mesh.visible, true);
  layer.setStyle({ ...enabled, color: '#ff0000', texture: 1 });
  layer.update({ ...inputs });
  assert.equal(layer.mesh.geometry, built, 'unchanged terrain inputs reuse the geometry');
  layer.setStyle({ ...enabled, widthMm: 1.5 });
  assert.notEqual(layer.mesh.geometry, built);
});

void test('suppressed or disabled roads are hidden without discarding their geometry', () => {
  const layer = createTerrainRoadLayer();

  layer.update(inputs);
  layer.setStyle(enabled);
  const built = layer.mesh.geometry;

  layer.setSuppressed(true);
  assert.equal(layer.mesh.visible, false);
  layer.setSuppressed(false);
  assert.equal(layer.mesh.visible, true);
  layer.setStyle({ ...enabled, enabled: false });
  assert.equal(layer.mesh.visible, false);
  assert.equal(layer.mesh.geometry, built);
});
