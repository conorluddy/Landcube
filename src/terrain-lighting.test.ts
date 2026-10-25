import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultTerrainLighting, getSuggestedTerrainLightDirection } from './terrain-lighting';

void test('lighting defaults are low and hemisphere suggestions use compass bearings', () => {
  assert.equal(defaultTerrainLighting.elevation, 10);
  assert.equal(defaultTerrainLighting.fill, 0.1);
  assert.equal(getSuggestedTerrainLightDirection(53), 120);
  assert.equal(getSuggestedTerrainLightDirection(-34), 60);
  assert.equal(getSuggestedTerrainLightDirection(0), 90);
  assert.equal(getSuggestedTerrainLightDirection(), defaultTerrainLighting.direction);
});
