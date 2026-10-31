import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  centredBalance,
  getBalancingTilt,
  maxBalanceOffsetEyeHeights,
  stepBalance,
  type BalanceState,
} from './balance';

const gravity = 7;
const stepSeconds = 1 / 60;

function simulate(state: BalanceState, seconds: number, accelerationX = 0) {
  let current = state;
  const offsets: number[] = [];

  for (let elapsed = 0; elapsed < seconds; elapsed += stepSeconds) {
    current = stepBalance(current, accelerationX, 0, gravity, stepSeconds).state;
    offsets.push(current.offsetX);
  }

  return { final: current, offsets };
}

void test('swinging the hurl left sends the ball sliding right across the bas', () => {
  const { final } = simulate(centredBalance, 0.1, -20);

  assert.ok(final.offsetX > 0, `offset ${final.offsetX}`);
});

void test('the carrier tilts the bas downhill towards the middle', () => {
  const tilt = getBalancingTilt({ ...centredBalance, offsetX: 0.03 }, gravity);

  assert.ok(tilt.slopeX < 0);
  assert.ok(Math.abs(tilt.slopeZ) < 1e-12);
});

void test('a drifting ball wobbles past the middle once, then settles there', () => {
  const { final, offsets } = simulate({ ...centredBalance, offsetX: 0.04 }, 3);

  assert.ok(Math.min(...offsets) < 0, 'expected one overshoot');
  assert.ok(Math.abs(final.offsetX) < 1e-3, `settled at ${final.offsetX}`);
});

void test('a hard flick pins the ball at the rim instead of throwing it off', () => {
  const { offsets } = simulate(centredBalance, 1, -500);

  assert.ok(Math.max(...offsets) <= maxBalanceOffsetEyeHeights + 1e-9);
});

void test('the lean never passes about fifteen degrees', () => {
  const tilt = getBalancingTilt({ ...centredBalance, offsetX: 0.06, velocityX: 2 }, gravity);

  assert.ok(Math.hypot(tilt.slopeX, tilt.slopeZ) <= Math.tan((15 * Math.PI) / 180) + 1e-9);
});
