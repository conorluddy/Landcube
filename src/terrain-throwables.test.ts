import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import {
  boomerangDurationSeconds,
  getTossLookLift,
  isInStrikeZone,
  launchBoomerang,
  launchSliotar,
  launchToss,
  planTossView,
  strikeZoneEyeHeights,
  stepProjectile,
  type Projectile,
} from './terrain-throwables';
import { getWalkScale } from './terrain-walk';

const scale = getWalkScale(100);
const stepSeconds = 1 / 60;

type Ground = (x: number, z: number) => number | undefined;

const flat: Ground = (x, z) => (Math.hypot(x, z) < 10 ? 0 : undefined);
const farAway = new THREE.Vector3(1000, 0, 1000);

function simulate(
  projectile: Projectile,
  seconds: number,
  ground: Ground = flat,
  catcher = farAway,
) {
  const kinds: string[] = [];
  const heights: number[] = [];
  let current: Projectile | undefined = projectile;

  for (let elapsed = 0; elapsed < seconds && current; elapsed += stepSeconds) {
    current = stepProjectile(current, stepSeconds, ground, scale, catcher);
    kinds.push(current?.kind ?? 'gone');
    heights.push(current?.position.y ?? 0);
  }

  return { final: current, kinds, heights };
}

void test('on flat ground a struck sliotar bounces lower each time and comes to rest', () => {
  const origin = new THREE.Vector3(0, scale.eyeHeight, 0);
  const projectile = launchSliotar(origin, new THREE.Vector3(0, 1, 0.3), 0.3, scale);
  const { final, heights } = simulate(projectile, 30);
  const peaks = heights.filter(
    (height, index) =>
      index > 0 && height > (heights[index - 1] ?? 0) && height >= (heights[index + 1] ?? 0),
  );

  assert.equal(final?.kind, 'resting');
  assert.ok(peaks.length >= 2, `expected several bounces, got ${peaks.length}`);
  peaks.slice(1).forEach((peak, index) => {
    assert.ok(peak < (peaks[index] ?? Infinity));
  });
});

void test('on a slope a resting sliotar rolls downhill', () => {
  const slope = (x: number) => (Math.abs(x) < 10 ? -0.3 * x : undefined);
  const start = new THREE.Vector3(0, 0, 0);
  const projectile: Projectile = {
    kind: 'rolling',
    item: 'sliotar',
    position: start.clone(),
    velocity: new THREE.Vector3(),
  };
  const { final } = simulate(projectile, 1, slope);

  assert.ok(final && final.position.x > start.x + scale.eyeHeight * 0.1);
});

void test('a boomerang returns to its origin after its flight', () => {
  const origin = new THREE.Vector3(0, scale.eyeHeight, 0);
  const projectile = launchBoomerang(origin, new THREE.Vector3(1, 0, 0), 1, scale);
  const { final: current } = simulate(projectile, boomerangDurationSeconds - stepSeconds / 2);

  assert.equal(current?.kind, 'returning');
  assert.ok(current.position.distanceTo(origin) < scale.eyeHeight * 0.05);
});

void test('a boomerang returning near the walker is caught', () => {
  const origin = new THREE.Vector3(0, scale.eyeHeight, 0);
  const projectile = launchBoomerang(origin, new THREE.Vector3(1, 0, 0), 0.5, scale);
  const { final } = simulate(projectile, boomerangDurationSeconds + 0.5, flat, origin);

  assert.equal(final, undefined);
});

void test('a sliotar struck off the model edge is lost and resets', () => {
  const origin = new THREE.Vector3(9, scale.eyeHeight, 0);
  const projectile = launchSliotar(origin, new THREE.Vector3(1, 0.2, 0), 1, scale);
  const { final, kinds } = simulate(projectile, 10);

  assert.equal(final, undefined);
  assert.equal(kinds.at(-1), 'gone');
});

void test('a tossed sliotar rises a couple of eye heights and falls back past the hand', () => {
  const origin = new THREE.Vector3(0, 2 * scale.eyeHeight, 0);
  const { heights } = simulate(launchToss(origin, scale), 2);
  const peak = Math.max(...heights) - origin.y;

  assert.ok(
    peak > 2 * scale.eyeHeight && peak < 3 * scale.eyeHeight,
    `peak ${peak / scale.eyeHeight}`,
  );
  assert.ok(heights.some((height) => height < origin.y));
});

void test('a swing connects only when the ball is at the bas', () => {
  const bas = new THREE.Vector3(0, scale.eyeHeight, 0);
  const near = bas
    .clone()
    .add(new THREE.Vector3(0, strikeZoneEyeHeights * scale.eyeHeight * 0.5, 0));
  const high = bas.clone().add(new THREE.Vector3(0, strikeZoneEyeHeights * scale.eyeHeight * 2, 0));

  assert.equal(isInStrikeZone(near, bas, scale), true);
  assert.equal(isInStrikeZone(high, bas, scale), false);
});

void test('the look lifts with a toss so the ball meets the top edge at its peak', () => {
  const eye = new THREE.Vector3(0, scale.eyeHeight, 0);
  const ball = new THREE.Vector3(0, 0.2 * scale.eyeHeight, -0.8 * scale.eyeHeight);
  const halfFov = THREE.MathUtils.degToRad(35);
  const view = planTossView(eye, ball, scale, 0, halfFov);

  assert.ok(view.peakLift > 0);
  assert.equal(getTossLookLift(view, view.startAngle), 0);
  assert.ok(Math.abs(getTossLookLift(view, view.peakAngle) - view.peakLift) < 1e-9);
  assert.ok(view.peakAngle - view.peakLift < halfFov);
});
