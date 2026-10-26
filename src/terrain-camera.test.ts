import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  baseTerrainFovDegrees,
  defaultTerrainCameraSettings,
  getCompensatedDistance,
  getDistanceForHalfHeight,
  getNearestStopIndex,
  getOrthographicHalfHeight,
  getVerticalFovDegrees,
  terrainFocalLengthStopsMm,
} from './terrain-camera';

void test('full-frame focal lengths convert to familiar vertical fields of view', () => {
  assert.ok(Math.abs(getVerticalFovDegrees(50) - 27) < 0.1);
  assert.ok(Math.abs(getVerticalFovDegrees(24) - 53.13) < 0.01);
  assert.ok(getVerticalFovDegrees(300) < 5);
});

void test('the default lens stays close to the original 40 degree view', () => {
  const fov = getVerticalFovDegrees(defaultTerrainCameraSettings.focalLengthMm);

  assert.ok(Math.abs(fov - baseTerrainFovDegrees) < 2.5);
  assert.ok(terrainFocalLengthStopsMm.includes(35));
});

void test('changing focal length keeps the framed size of the target constant', () => {
  const distance = 3;
  const wide = getVerticalFovDegrees(24);
  const tele = getVerticalFovDegrees(200);
  const teleDistance = getCompensatedDistance(distance, wide, tele);

  assert.ok(teleDistance > distance * 8);
  assert.ok(
    Math.abs(
      getOrthographicHalfHeight(distance, wide) - getOrthographicHalfHeight(teleDistance, tele),
    ) < 1e-9,
  );
});

void test('orthographic framing round-trips back to the same perspective distance', () => {
  const halfHeight = getOrthographicHalfHeight(2.5, 40);

  assert.ok(Math.abs(getDistanceForHalfHeight(halfHeight, 40) - 2.5) < 1e-9);
});

void test('focal lengths between stops show on the nearest stop', () => {
  assert.equal(getNearestStopIndex(terrainFocalLengthStopsMm, 35), 2);
  assert.equal(getNearestStopIndex(terrainFocalLengthStopsMm, 60), 3);
  assert.equal(getNearestStopIndex(terrainFocalLengthStopsMm, 1000), 7);
});
