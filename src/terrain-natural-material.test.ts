import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTerrainDepths } from './terrain-natural-material';

void test('cut depth follows local surface heights, including duplicated wall vertices', () => {
  const surface = [0, 0.2, 0, 1, 0.5, 0, 0, 0.3, 1];
  const walls = [0, 0.2, 0, 0, 0, 0, 1, 0.5, 0, 1, 0, 0, 1, 0, 0, 0.5, 0, 0.5];
  const depths = createTerrainDepths(surface, walls);

  assert.deepEqual(Array.from(depths), [0, Math.fround(0.2), 0, 0.5, 0.5, 0]);
  assert.deepEqual(Array.from(createTerrainDepths(surface, surface)), [0, 0, 0]);
});
