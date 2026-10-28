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
    footprint: { shape: 'rectangle', width: 200, height: 200 },
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
    bladesPerSquareCm: enabled.bladesPerSquareCm / 2,
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

void test('a terrain without a grass site hides the carpet and lets go of the surface', () => {
  const layer = createTerrainGrassLayer();

  layer.update(inputs);
  layer.setStyle(enabled);
  layer.update(undefined);

  assert.equal(layer.mesh.visible, false);
  assert.notEqual(layer.mesh.geometry, inputs.surface);
  layer.update(inputs);
  assert.equal(layer.mesh.visible, true);
});

void test('roads regrow the mask; wind animates only visible grass while motion is allowed', (t) => {
  const layer = createTerrainGrassLayer();

  layer.update(inputs);
  layer.setStyle(enabled);
  const coverage = layer.getCoverage();
  const road = {
    points: [
      { x: 0, y: 100 },
      { x: 200, y: 100 },
    ],
    halfWidth: 4,
  };

  layer.update({ ...inputs, site: { ...inputs.site, roads: [road] } });
  assert.notEqual(layer.getCoverage(), coverage);

  assert.equal(layer.isAnimated(), true);
  layer.setStyle({ ...enabled, wind: 0 });
  assert.equal(layer.isAnimated(), false);
  layer.setStyle(enabled);
  layer.setSuppressed(true);
  assert.equal(layer.isAnimated(), false);
  layer.setSuppressed(false);

  // Node has no matchMedia, so stand one in that prefers reduced motion.
  Object.assign(globalThis, { matchMedia: () => ({ matches: true }) });
  t.after(() => {
    Reflect.deleteProperty(globalThis, 'matchMedia');
  });
  assert.equal(layer.isAnimated(), false);
});

void test('settled grass keeps its wind setting for when motion resumes', () => {
  const layer = createTerrainGrassLayer();

  layer.update(inputs);
  layer.setSettled(true);
  layer.setStyle({ ...enabled, wind: 0.8 });
  assert.equal(layer.isAnimated(), true);
  layer.setSettled(false);
  assert.equal(layer.isAnimated(), true);
});
