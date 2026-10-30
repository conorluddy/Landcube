import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getWalkScale } from './terrain-walk';

void test('a walker on a sub-kilometre map stands at a human 1.7 m eye height', () => {
  const metersPerUnit = 100;

  assert.ok(Math.abs(getWalkScale(metersPerUnit).eyeHeight * metersPerUnit - 1.7) < 1e-9);
});

void test('a walker on a kilometres-wide map rises above the coarse mesh instead of sinking into it', () => {
  assert.equal(getWalkScale(4000).eyeHeight, 0.01);
  assert.equal(getWalkScale(50_000).eyeHeight, 0.01);
});

void test('walking speed, jump and near plane follow the eye height, so every map feels alike', () => {
  const small = getWalkScale(40);
  const large = getWalkScale(100);
  const ratio = small.eyeHeight / large.eyeHeight;

  assert.ok(Math.abs(small.walkSpeedPerSecond / large.walkSpeedPerSecond - ratio) < 1e-9);
  assert.ok(Math.abs(small.jumpSpeedPerSecond / large.jumpSpeedPerSecond - ratio) < 1e-9);
  assert.ok(Math.abs(small.nearPlane / large.nearPlane - ratio) < 1e-9);
  assert.ok(small.nearPlane < small.eyeHeight);
});
