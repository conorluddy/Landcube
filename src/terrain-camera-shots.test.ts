import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  advanceCameraShotPlayback,
  cameraShotHoldMs,
  cameraShotMoveMs,
  easeInOutCubic,
  interpolateCameraShot,
  type CameraShot,
} from './terrain-camera-shots';

const north: CameraShot = {
  target: { x: 0, y: 0, z: 0 },
  direction: { x: 0, y: 0, z: -1 },
  distance: 2,
};
const east: CameraShot = {
  target: { x: 1, y: 0, z: 0 },
  direction: { x: 1, y: 0, z: 0 },
  distance: 4,
};

void test('interpolation starts and ends exactly on the shots', () => {
  assert.deepEqual(interpolateCameraShot(north, east, 0), north);
  assert.deepEqual(interpolateCameraShot(north, east, 1), east);
});

void test('easing is symmetric about the midpoint', () => {
  assert.equal(easeInOutCubic(0.5), 0.5);
  assert.ok(easeInOutCubic(0.1) < 0.1);
  assert.ok(easeInOutCubic(0.9) > 0.9);
});

void test('the midpoint direction stays unit length', () => {
  const { direction, distance } = interpolateCameraShot(north, east, 0.5);

  assert.ok(Math.abs(Math.hypot(direction.x, direction.y, direction.z) - 1) < 1e-9);
  assert.equal(distance, 3);
});

void test('playback moves, holds, then loops to the first shot', () => {
  let playback = advanceCameraShotPlayback({ kind: 'moving', index: 1, startedAtMs: 0 }, 10, 2);

  assert.equal(playback.kind, 'moving');
  playback = advanceCameraShotPlayback(playback, cameraShotMoveMs, 2);
  assert.deepEqual(playback, { kind: 'holding', index: 1, startedAtMs: cameraShotMoveMs });
  playback = advanceCameraShotPlayback(playback, cameraShotMoveMs + cameraShotHoldMs, 2);
  assert.deepEqual(playback, {
    kind: 'moving',
    index: 0,
    startedAtMs: cameraShotMoveMs + cameraShotHoldMs,
  });
});

void test('playback without shots goes idle', () => {
  assert.deepEqual(advanceCameraShotPlayback({ kind: 'holding', index: 0, startedAtMs: 0 }, 0, 0), {
    kind: 'idle',
  });
});

void test('a frame after a long pause starts the next phase now instead of skipping shots', () => {
  const pausedMs = 60_000;
  const playback = advanceCameraShotPlayback(
    { kind: 'moving', index: 0, startedAtMs: 0 },
    pausedMs,
    3,
  );

  assert.deepEqual(playback, { kind: 'holding', index: 0, startedAtMs: pausedMs - 100 });
  assert.equal(advanceCameraShotPlayback(playback, pausedMs + 16, 3), playback);
});

void test('without a move the tour cuts to each shot and holds there', () => {
  const playback = advanceCameraShotPlayback({ kind: 'moving', index: 1, startedAtMs: 0 }, 0, 2, 0);

  assert.deepEqual(playback, { kind: 'holding', index: 1, startedAtMs: 0 });
});
