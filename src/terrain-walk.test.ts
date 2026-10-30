import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getWalkScale } from './terrain-walk';

void test('a walker on a 2 km map stands at a human 1.7 m eye height', () => {
  const metersPerUnit = 1000;

  assert.equal(getWalkScale(metersPerUnit).eyeHeight * metersPerUnit, 1.7);
});

void test('a walker on a 100 km map rises above the coarse mesh instead of sinking into it', () => {
  const metersPerUnit = 50_000;

  assert.equal(getWalkScale(metersPerUnit).eyeHeight, 0.0003);
});

void test('walking speed, jump and near plane follow the eye height, so every map feels alike', () => {
  const small = getWalkScale(1000);
  const large = getWalkScale(2500);
  const ratio = small.eyeHeight / large.eyeHeight;

  assert.ok(Math.abs(small.walkSpeedPerSecond / large.walkSpeedPerSecond - ratio) < 1e-9);
  assert.ok(Math.abs(small.jumpSpeedPerSecond / large.jumpSpeedPerSecond - ratio) < 1e-9);
  assert.ok(Math.abs(small.nearPlane / large.nearPlane - ratio) < 1e-9);
  assert.ok(small.nearPlane < small.eyeHeight);
});
