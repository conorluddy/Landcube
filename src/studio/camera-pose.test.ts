import assert from 'node:assert/strict';
import test from 'node:test';
import type { CameraPose } from '../terrain-camera';
import { createCameraPosePublisher, roundCameraPose, type PublisherClock } from './camera-pose';

function createFakeClock(): PublisherClock & { advanceTo: (timeMs: number) => void } {
  let nowMs = 0;
  let nextTimer = 1;
  const timers = new Map<number, { atMs: number; callback: () => void }>();

  return {
    now: () => nowMs,
    setTimeout(callback, delayMs) {
      timers.set(nextTimer, { atMs: nowMs + delayMs, callback });

      return nextTimer++;
    },
    clearTimeout(timer) {
      timers.delete(timer);
    },
    advanceTo(timeMs) {
      for (const [timer, { atMs, callback }] of [...timers].sort((a, b) => a[1].atMs - b[1].atMs)) {
        if (atMs <= timeMs) {
          timers.delete(timer);
          nowMs = atMs;
          callback();
        }
      }

      nowMs = timeMs;
    },
  };
}

const pose = (azimuthDegrees: number): CameraPose => ({
  azimuthDegrees,
  elevationDegrees: 34,
  fovDegrees: 38,
});

void test('an orbit offered at 60 frames a second publishes at most 20 poses a second', () => {
  const clock = createFakeClock();
  const publishedAtMs: number[] = [];
  const publisher = createCameraPosePublisher(() => publishedAtMs.push(clock.now()), clock);

  for (let frame = 0; frame < 120; frame++) {
    clock.advanceTo((frame * 1000) / 60);
    publisher.offer(pose(frame * 2));
  }

  clock.advanceTo(2000);
  const inSecondWindow = publishedAtMs.filter((timeMs) => timeMs >= 500 && timeMs < 1500);

  assert.ok(inSecondWindow.length <= 20, `published ${inSecondWindow.length} poses in one second`);
  assert.ok(inSecondWindow.length >= 15, 'a steady orbit still updates the readout continuously');
});

void test('the resting pose is published after the throttle window', () => {
  const clock = createFakeClock();
  const published: CameraPose[] = [];
  const publisher = createCameraPosePublisher((next) => published.push(next), clock);

  publisher.offer(pose(10));
  clock.advanceTo(10);
  publisher.offer(pose(20));
  clock.advanceTo(20);
  publisher.offer(pose(30));
  clock.advanceTo(200);

  assert.deepEqual(
    published.map((next) => next.azimuthDegrees),
    [10, 30],
  );
});

void test('an unchanged pose is never republished', () => {
  const clock = createFakeClock();
  const published: CameraPose[] = [];
  const publisher = createCameraPosePublisher((next) => published.push(next), clock);

  publisher.offer(pose(10));
  clock.advanceTo(100);
  publisher.offer(pose(10.2));
  clock.advanceTo(200);

  assert.equal(published.length, 1);
});

void test('poses round to whole degrees and wrap azimuth below 360', () => {
  assert.deepEqual(
    roundCameraPose({ azimuthDegrees: 359.7, elevationDegrees: 33.6, fovDegrees: 37.8 }),
    { azimuthDegrees: 0, elevationDegrees: 34, fovDegrees: 38 },
  );
});
