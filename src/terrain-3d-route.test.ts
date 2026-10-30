import assert from 'node:assert/strict';
import test from 'node:test';
import type { Mesh } from 'three';
import {
  clipRouteToCrop,
  createTerrainRouteLayer,
  noRouteOverlay,
  type TerrainRouteInputs,
} from './terrain-3d-route';
import type { HeightField } from './types/terrain';

const field: HeightField = {
  columns: 11,
  rows: 11,
  originX: 0,
  originY: 0,
  spacing: 10,
  values: new Float64Array(121),
};
const inputs: TerrainRouteInputs = {
  paths: [
    {
      roadClass: 'secondary',
      points: [
        { x: 10, y: 50 },
        { x: 90, y: 50 },
      ],
    },
  ],
  waypoints: [{ x: 50, y: 50 }],
  field,
  width: 100,
  height: 100,
  modelSettings: { widthMm: 150, lengthMm: 150, baseThicknessMm: 3 },
  exaggeration: 0.3,
  elevationOffset: 0,
};

void test('a route builds a visible ribbon and one marker per waypoint', () => {
  const layer = createTerrainRouteLayer();

  layer.update(inputs);

  assert.ok(layer.getCounts().points > 2);
  assert.equal(layer.getCounts().waypoints, 1);
});

void test('an empty route draws nothing and reports zero counts', () => {
  const layer = createTerrainRouteLayer();

  layer.update({ ...inputs, ...noRouteOverlay });

  assert.deepEqual(layer.getCounts(), { points: 0, waypoints: 0 });
});

void test('suppressed routes hide the ribbon and markers without discarding them', () => {
  const layer = createTerrainRouteLayer();

  layer.update(inputs);
  layer.setSuppressed(true);
  assert.deepEqual(layer.getCounts(), { points: 0, waypoints: 0 });
  layer.setSuppressed(false);
  assert.equal(layer.getCounts().waypoints, 1);
});

void test('the ribbon sits above the road lift so a route over a road stays visible', () => {
  const layer = createTerrainRouteLayer();

  layer.update(inputs);
  const mesh = layer.object.children[0] as Mesh;
  const positions = mesh.geometry.getAttribute('position');

  assert.ok(positions.getY(0) > 0.0006);
});

void test('clipping keeps waypoints inside the crop and drops route outside it', () => {
  const placement = { location: { latitude: 55, longitude: -8 }, spanKm: 10 };
  const frame = { width: 800, height: 600 };
  const crop = { x: 100, y: 100, width: 400, height: 400 };
  const overlay = clipRouteToCrop(
    {
      points: [
        { latitude: 55, longitude: -8 },
        { latitude: 55.5, longitude: -8 },
      ],
      waypoints: [
        { name: 'In', latitude: 55, longitude: -8 },
        { name: 'Out', latitude: 55.5, longitude: -8 },
      ],
    },
    placement,
    frame,
    crop,
    'rectangle',
  );

  assert.equal(overlay.waypoints.length, 1);
  assert.deepEqual(overlay.waypoints[0], { x: 300, y: 200 });
  assert.equal(overlay.paths.length, 1);
});
