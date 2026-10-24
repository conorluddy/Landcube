import { versionOneDesignDefaults } from '../src/constants/design';
import { engineConfiguration } from '../src/constants/engine';
import { extractContourAtElevation } from '../src/contour-extraction';
import { applyCursorElevation } from '../src/cursor-interaction';
import { deriveTerrainConfiguration } from '../src/design-settings';
import { calculateContourElevations } from '../src/landscape-composition';
import { createTerrainSampler, sampleTerrain } from '../src/terrain-generation';
import { isPointOnHeightFieldBoundary } from './terrain-test-helpers';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const terrainSettings = deriveTerrainConfiguration(versionOneDesignDefaults, engineConfiguration);

await test('cursor adds a smooth local hill, preserves cached terrain, and restores it exactly', () => {
  /** Verifies cursor adds a smooth local hill, preserves cached terrain, and restores it exactly. */
  const base = sampleTerrain(() => 0, 400, 400, terrainSettings);
  const raised = applyCursorElevation(
    base,
    { x: 200, y: 200, strength: 1 },
    versionOneDesignDefaults,
  );
  /** Reads a sampled elevation at an exact world coordinate. */
  const at = (x: number, y: number) =>
    raised.values[
      ((y - base.originY) / base.spacing) * base.columns + (x - base.originX) / base.spacing
    ];

  assert.equal(at(200, 200), versionOneDesignDefaults.cursorHeight);
  assert.equal(at(200 + versionOneDesignDefaults.cursorRadius, 200), 0);
  assert.equal(at(0, 0), 0);
  assert.ok(at(250, 200) < at(200, 200));
  assert.ok(at(250, 200) > at(300, 200));
  assert.equal(at(250, 200), at(150, 200));
  assert.ok(base.values.every((value) => value === 0));
  assert.equal(
    applyCursorElevation(base, { x: 200, y: 200, strength: 0 }, versionOneDesignDefaults),
    base,
  );
  const partial = applyCursorElevation(
    base,
    { x: 200, y: 200, strength: 0.5 },
    versionOneDesignDefaults,
  );

  assert.ok(partial.values.every((value, index) => value === raised.values[index] * 0.5));
});

await test('cursor-influenced contours remain closed or terminate on the field boundary', () => {
  const base = sampleTerrain(createTerrainSampler(7, terrainSettings), 390, 844, terrainSettings);

  for (const position of [
    { x: 0, y: 0 },
    { x: 195, y: 422 },
    { x: 390, y: 844 },
  ]) {
    const raised = applyCursorElevation(
      base,
      { ...position, strength: 1 },
      versionOneDesignDefaults,
    );

    for (const elevation of calculateContourElevations(
      versionOneDesignDefaults,
      engineConfiguration,
    )) {
      for (const path of extractContourAtElevation(raised, elevation).paths) {
        if (!path.closed) {
          assert.ok(isPointOnHeightFieldBoundary(path.points[0], base));
          assert.ok(isPointOnHeightFieldBoundary(path.points.at(-1), base));
        }
      }
    }
  }
});
