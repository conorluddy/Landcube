import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  createTerrainGrassLayer,
  grassShellCount,
  type TerrainGrassInputs,
} from './terrain-3d-grass';
import { defaultGrassStyle } from './constants/grass';

const inputs: TerrainGrassInputs = {
  site: {
    field: {
      columns: 41,
      rows: 41,
      originX: 0,
      originY: 0,
      spacing: 5,
      values: new Float64Array(41 * 41),
    },
    width: 200,
    height: 200,
    shape: 'rectangle',
    originX: 0,
    originY: 0,
    frameUnitsPerMm: 2,
    metersPerFieldUnit: 1000,
    metersPerFrameUnit: 10,
    roads: [],
  },
  surface: new THREE.PlaneGeometry(2, 2, 4, 4).rotateX(-Math.PI / 2),
};
const enabled = { ...defaultGrassStyle, enabled: true, coverage: 1 };

void test('shells borrow the terrain surface instead of copying it', () => {
  const layer = createTerrainGrassLayer();

  layer.update(inputs);
  layer.setStyle(enabled);

  assert.equal(layer.mesh.geometry, inputs.surface);
  assert.equal(layer.mesh.count, grassShellCount);
  assert.equal(layer.mesh.visible, true);
});

void test('colour, length, density and wind restyle grass without regrowing it', () => {
  const layer = createTerrainGrassLayer();

  layer.update(inputs);
  layer.setStyle(enabled);
  const coverage = layer.getCoverage();

  layer.setStyle({
    ...enabled,
    baseColor: '#ff0000',
    dryness: 0.9,
    wind: 1,
    colorVariation: 1,
    lengthMm: enabled.lengthMm * 2,
    density: enabled.density / 2,
  });

  assert.ok(coverage);
  assert.equal(layer.getCoverage(), coverage);
});

void test('coverage edits regrow the mask', () => {
  const layer = createTerrainGrassLayer();

  layer.update(inputs);
  layer.setStyle(enabled);
  const coverage = layer.getCoverage();

  layer.setStyle({ ...enabled, coverage: 0.4 });

  assert.notEqual(layer.getCoverage(), coverage);
});

void test('suppressed or disabled grass hides without discarding its mask', () => {
  const layer = createTerrainGrassLayer();

  layer.update(inputs);
  layer.setStyle(enabled);
  const coverage = layer.getCoverage();

  layer.setSuppressed(true);
  assert.equal(layer.mesh.visible, false);
  layer.setSuppressed(false);
  layer.setStyle({ ...enabled, enabled: false });
  assert.equal(layer.mesh.visible, false);
  assert.equal(layer.getCoverage(), coverage);
});
