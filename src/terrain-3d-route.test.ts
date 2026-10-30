import assert from 'node:assert/strict';
import test from 'node:test';
import type { Mesh } from 'three';
import {
  clipRouteToCrop,
  createTerrainRouteLayer,
  noRouteOverlay,
  projectRoutePointToCrop,
  type TerrainRouteInputs,
} from './terrain-3d-route';
import { createDisplayedSurface } from './terrain-3d-route-drape';
import { defaultTerrainModelSettings } from './terrain-model';
import type { HeightField } from './types/terrain';

const field: HeightField = {
  columns: 11,
  rows: 11,
  originX: 0,
  originY: 0,
  spacing: 10,
  values: new Float64Array(121),
};
const surfaceInputs = {
  field,
  width: 100,
  height: 100,
  modelSettings: defaultTerrainModelSettings,
  exaggeration: 0.3,
  elevationOffset: 0,
};
const surface = createDisplayedSurface(surfaceInputs);
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
  surface,
};
const placement = { location: { latitude: 55, longitude: -8 }, spanKm: 10 };
const frame = { width: 800, height: 600 };
const crop = { x: 100, y: 100, width: 400, height: 400 };

void test('a route builds a visible ribbon and one marker per waypoint', () => {
  const layer = createTerrainRouteLayer();

  layer.update(inputs);

  assert.ok(layer.getCounts().points > 2);
  assert.equal(layer.getCounts().waypoints, 1);
});

void test('an empty route draws nothing and reports zero counts', () => {
  const layer = createTerrainRouteLayer();

  layer.update({ ...inputs, ...noRouteOverlay });

  assert.deepEqual(layer.getCounts(), { points: 0, waypoints: 0, markers: 0, builds: 1 });
});

void test('suppressed routes hide the ribbon and markers without discarding them', () => {
  const layer = createTerrainRouteLayer();

  layer.update(inputs);
  layer.setSuppressed(true);
  assert.deepEqual(layer.getCounts(), { points: 0, waypoints: 0, markers: 0, builds: 1 });
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

void test('repeated updates on an unchanged surface keep the built ribbon', () => {
  const layer = createTerrainRouteLayer();

  layer.update(inputs);
  layer.update({ ...inputs });
  assert.equal(layer.getCounts().builds, 1);

  layer.update({ ...inputs, surface: createDisplayedSurface(surfaceInputs) });
  assert.equal(layer.getCounts().builds, 2, 'a new terrain rebuilds against its surface');
});

void test('moving the inspection marker never rebuilds the ribbon', () => {
  const layer = createTerrainRouteLayer();

  layer.update(inputs);
  layer.setInspectedPoint({ x: 30, y: 50 });
  assert.equal(layer.getCounts().markers, 1);
  const marker = layer.object.children[2];
  const firstX = marker.position.x;

  layer.setInspectedPoint({ x: 70, y: 50 });
  assert.ok(marker.position.x > firstX);
  layer.setInspectedPoint(undefined);
  assert.equal(layer.getCounts().markers, 0);
  assert.equal(layer.getCounts().builds, 1);
});

void test('clipping keeps waypoints inside the crop and drops route outside it', () => {
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

void test('a route point projects into crop units and misses outside the model', () => {
  const project = (latitude: number) =>
    projectRoutePointToCrop({ latitude, longitude: -8 }, placement, frame, crop, 'rectangle');

  assert.deepEqual(project(55), { x: 300, y: 200 });
  assert.equal(project(55.5), undefined);
});
