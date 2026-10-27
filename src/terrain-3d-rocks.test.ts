import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createTerrainRockLayer, type TerrainRockInputs } from './terrain-3d-rocks';
import { defaultRockStyle } from './constants/rocks';

const inputs: TerrainRockInputs = {
  site: {
    field: {
      columns: 41,
      rows: 41,
      originX: 0,
      originY: 0,
      spacing: 5,
      values: Float64Array.from({ length: 41 * 41 }, (_, index) => (index % 41) * 0.01),
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
const enabled = { ...defaultRockStyle, enabled: true, rocksPerSquareCm: 20 };

/** Every instance's position, in mesh order. */
function positions(layer: ReturnType<typeof createTerrainRockLayer>): THREE.Vector3[] {
  const matrix = new THREE.Matrix4();

  return layer.group.children.flatMap((child) => {
    const mesh = child as THREE.InstancedMesh;

    return Array.from({ length: mesh.count }, (_, index) => {
      mesh.getMatrixAt(index, matrix);

      return new THREE.Vector3().setFromMatrixPosition(matrix);
    });
  });
}

void test('every placed rock is drawn once, across the shape bank', () => {
  const layer = createTerrainRockLayer();

  layer.update(inputs);
  layer.setStyle(enabled);
  const placed = layer.getInstances();

  assert.ok(placed && placed.count > 50);
  assert.equal(positions(layer).length, placed.count);
  assert.equal(layer.group.visible, true);
});

void test('colour and shape edits keep every rock where it is', () => {
  const layer = createTerrainRockLayer();

  layer.update(inputs);
  layer.setStyle(enabled);
  const placed = layer.getInstances();
  const before = positions(layer);

  layer.setStyle({ ...enabled, baseColor: '#ff0000', accentColor: '#00ff00', colorVariation: 1 });
  assert.deepEqual(positions(layer), before);
  layer.setStyle({ ...enabled, angularity: 1, elongation: 1 });
  assert.equal(layer.getInstances(), placed);
  assert.equal(positions(layer).length, before.length);
});

void test('density edits re-place rocks; suppressed or disabled rocks hide without discarding', () => {
  const layer = createTerrainRockLayer();

  layer.update(inputs);
  layer.setStyle(enabled);
  const placed = layer.getInstances();

  layer.setSuppressed(true);
  assert.equal(layer.group.visible, false);
  assert.equal(layer.getInstances(), undefined, 'hidden rocks clear no grass');
  layer.setSuppressed(false);
  assert.equal(layer.getInstances(), placed);
  layer.setStyle({ ...enabled, rocksPerSquareCm: 4 });
  assert.notEqual(layer.getInstances(), placed);
  layer.update(undefined);
  assert.equal(layer.group.visible, false);
});
