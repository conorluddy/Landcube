import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createTerrainGrassLayer, type TerrainGrassInputs } from './terrain-3d-grass';
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
  exaggeration: 0.3,
  elevationOffset: 0,
};
const enabled = { ...defaultGrassStyle, enabled: true, coverage: 1 };

function tufts(layer: ReturnType<typeof createTerrainGrassLayer>) {
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const size = new THREE.Vector3();

  return Array.from({ length: layer.mesh.count }, (_, index) => {
    layer.mesh.getMatrixAt(index, matrix);
    matrix.decompose(position, rotation, size);

    return { position: position.clone(), size: size.x };
  });
}

void test('colour, dryness and wind restyle grass without moving or resizing a tuft', () => {
  const layer = createTerrainGrassLayer();

  layer.update(inputs);
  layer.setStyle(enabled);
  const before = tufts(layer);

  layer.setStyle({ ...enabled, baseColor: '#ff0000', dryness: 0.9, wind: 1, colorVariation: 1 });

  assert.ok(before.length > 100);
  assert.deepEqual(tufts(layer), before);
  assert.equal(layer.mesh.visible, true);
});

void test('blade length scales tufts in place', () => {
  const layer = createTerrainGrassLayer();

  layer.update(inputs);
  layer.setStyle(enabled);
  const before = tufts(layer);

  layer.setStyle({ ...enabled, lengthMm: enabled.lengthMm * 2 });
  const after = tufts(layer);

  assert.equal(after.length, before.length);
  after.forEach((tuft, index) => {
    assert.ok(tuft.position.distanceTo(before[index].position) < 1e-9);
    assert.ok(Math.abs(tuft.size / before[index].size - 2) < 1e-6);
  });
});

void test('suppressed or disabled grass hides without discarding its tufts', () => {
  const layer = createTerrainGrassLayer();

  layer.update(inputs);
  layer.setStyle(enabled);
  const count = layer.mesh.count;

  layer.setSuppressed(true);
  assert.equal(layer.mesh.visible, false);
  layer.setSuppressed(false);
  layer.setStyle({ ...enabled, enabled: false });
  assert.equal(layer.mesh.visible, false);
  assert.equal(layer.mesh.count, count);
});
