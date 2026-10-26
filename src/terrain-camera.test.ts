import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  baseTerrainFovDegrees,
  defaultRotationSeconds,
  defaultTerrainCameraSettings,
  getAutoRotateSpeed,
  getBokehAperture,
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

void test('turntable speed matches the original auto-rotate at 30 seconds per revolution', () => {
  assert.equal(getAutoRotateSpeed(defaultRotationSeconds, 'counterclockwise'), 2);
  assert.equal(getAutoRotateSpeed(120, 'clockwise'), -0.5);
});

void test('wider apertures blur more and the default sits mid-range', () => {
  assert.ok(getBokehAperture(1.4) > getBokehAperture(22) * 15);
  assert.equal(defaultTerrainCameraSettings.apertureFStop, 2.8);
  assert.equal(defaultTerrainCameraSettings.focusEffect, 'off');
});
