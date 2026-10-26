import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMapGridSpacing } from './terrain-map-grid';

void test('map grid picks readable ground distances across small and large crops', () => {
  assert.equal(getMapGridSpacing(25000), 5000);
  assert.equal(getMapGridSpacing(4000), 500);
  assert.equal(getMapGridSpacing(800), 100);
  assert.equal(getMapGridSpacing(80), 10);
});
