import { versionOneDesignDefaults } from '../src/constants/design';
import { engineConfiguration } from '../src/constants/engine';
import { extractContourAtElevation, extractContours } from '../src/contour-extraction';
import { deriveTerrainConfiguration } from '../src/design-settings';
import { calculateContourElevations } from '../src/landscape-composition';
import { createTerrainSampler, sampleTerrain } from '../src/terrain-generation';
import type { HeightField } from '../src/types/terrain';
import { isPointOnHeightFieldBoundary } from './terrain-test-helpers';
import type { ContourSegmentFixture } from './terrain-test.types';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const terrainSettings = deriveTerrainConfiguration(versionOneDesignDefaults, engineConfiguration);

/** Builds a small explicit field for contour topology scenarios. */
function createHeightFieldFixture(values: number[], columns = 2, rows = 2): HeightField {
  return { columns, rows, spacing: 1, originX: 0, originY: 0, values: new Float64Array(values) };
}

const contourElevations = calculateContourElevations(versionOneDesignDefaults, engineConfiguration);

await test('a hill produces a closed contour with no duplicated joining vertices', () => {
  /** Verifies a hill produces a closed contour with no duplicated joining vertices. */
  const result = extractContourAtElevation(
    createHeightFieldFixture([0, 0, 0, 0, 1, 0, 0, 0, 0], 3, 3),
    0.5,
  );

  assert.equal(result.paths.length, 1);
  assert.equal(result.paths[0].closed, true);
  assert.equal(result.paths[0].points.length, 4);
});

await test('shared cell edges form one uninterrupted boundary-to-boundary path', () => {
  const result = extractContourAtElevation(
    createHeightFieldFixture([-1, 1, -1, 1, -1, 1], 2, 3),
    0,
  );

  assert.deepEqual(result.paths, [
    {
      closed: false,
      points: [
        { x: 0.5, y: 0 },
        { x: 0.5, y: 1 },
        { x: 0.5, y: 2 },
      ],
    },
  ]);
});

await test('saddles use the determinant, including when the center average disagrees', () => {
  /** Verifies saddles use the determinant, including when the center average disagrees. */
  for (const sign of [1, -1]) {
    // Center average is positive, but determinant is negative: a center test fails here.
    const result = extractContourAtElevation(
      createHeightFieldFixture([10, -4, -4, 1].map((value) => sign * value)),
      0,
    );

    assert.equal(result.paths.length, 2);
    assert.ok(result.paths.every((path) => !path.closed && path.points.length === 2));
    const first = result.paths[0].points;

    assert.equal(first[0].y, 0);
    assert.equal(first[1].x, 0);
  }

  const opposite = extractContourAtElevation(createHeightFieldFixture([4, -1, -1, 4]), 0).paths[0]
    .points;

  assert.equal(opposite[0].y, 0);
  assert.equal(opposite[1].x, 1);
});

await test('all 16 marching-square cases, including exact ties, remain finite and unbranched', () => {
  for (let mask = 0; mask < 16; mask++) {
    const corners = [0, 1, 3, 2].map((bit) => (mask & (1 << bit) ? 1 : -1));

    for (const multiplier of [1, 0]) {
      const paths = extractContourAtElevation(
        createHeightFieldFixture(corners.map((value) => (value > 0 ? value * multiplier : value))),
        0,
      ).paths;

      assert.ok(paths.every((path) => path.points.length === 2));
      assert.ok(
        paths
          .flatMap((path) => path.points)
          .every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
      );
    }
  }
});

await test('a fixed seed and viewport reproduce exact contour geometry', () => {
  /** Verifies a fixed seed and viewport reproduce exact contour geometry. */
  /** Recreates the same seeded composition to check determinism. */
  const generateSeededContours = () =>
    extractContours(
      sampleTerrain(createTerrainSampler(73421, terrainSettings), 390, 844, terrainSettings),
      contourElevations,
    );

  assert.deepEqual(generateSeededContours(), generateSeededContours());
  assert.notDeepEqual(
    generateSeededContours(),
    extractContours(
      sampleTerrain(createTerrainSampler(73422, terrainSettings), 390, 844, terrainSettings),
      contourElevations,
    ),
  );
});

await test('resizing preserves sampled terrain at every overlapping coordinate', () => {
  /** Verifies resizing preserves sampled terrain at every overlapping coordinate. */
  const terrain = createTerrainSampler(123, terrainSettings);
  const small = sampleTerrain(terrain, 390, 844, terrainSettings);
  const large = sampleTerrain(terrain, 1440, 900, terrainSettings);

  assert.equal(small.spacing, large.spacing);
  assert.equal(small.originX, large.originX);

  for (let y = 0; y < small.rows; y++) {
    for (let x = 0; x < small.columns; x++) {
      assert.equal(small.values[y * small.columns + x], large.values[y * large.columns + x]);
    }
  }
});

await test('ten seeds have loops and open paths, with every open endpoint on the sampled boundary', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const sampled = sampleTerrain(
      createTerrainSampler(seed, terrainSettings),
      1440,
      900,
      terrainSettings,
    );
    const paths = extractContours(sampled, contourElevations).flatMap((contour) => contour.paths);

    assert.ok(
      paths.some((path) => path.closed),
      `seed ${seed} lacks loops`,
    );
    assert.ok(
      paths.some((path) => !path.closed),
      `seed ${seed} lacks open paths`,
    );

    for (const path of paths) {
      if (!path.closed) {
        assert.ok(
          isPointOnHeightFieldBoundary(path.points[0], sampled),
          `seed ${seed}: interior start`,
        );
        assert.ok(
          isPointOnHeightFieldBoundary(path.points.at(-1), sampled),
          `seed ${seed}: interior end`,
        );
      }
    }
  }
});

await test('large screens stay within the sample budget', () => {
  /** Verifies large screens stay within the sample budget. */
  const sampled = sampleTerrain(
    createTerrainSampler(1, terrainSettings),
    15360,
    8640,
    terrainSettings,
  );

  assert.ok(sampled.values.length <= engineConfiguration.maxSamples);
  assert.ok(sampled.originX < 0 && sampled.originY < 0);
});

await test('contour segments do not cross within sampled cells across ten seeds', () => {
  /** Measures signed orientation for segment intersection assertions. */
  const orient = (
    a: ContourSegmentFixture['a'],
    b: ContourSegmentFixture['a'],
    c: ContourSegmentFixture['a'],
  ) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

  for (let seed = 1; seed <= 10; seed++) {
    const sampled = sampleTerrain(
      createTerrainSampler(seed, terrainSettings),
      1440,
      900,
      terrainSettings,
    );
    const cells = new Map<string, ContourSegmentFixture[]>();

    for (const contour of extractContours(sampled, contourElevations)) {
      for (const path of contour.paths) {
        const count = path.closed ? path.points.length : path.points.length - 1;

        for (let i = 0; i < count; i++) {
          const a = path.points[i];
          const b = path.points[(i + 1) % path.points.length];
          const key = `${Math.floor(((a.x + b.x) / 2 - sampled.originX) / sampled.spacing)},${Math.floor(((a.y + b.y) / 2 - sampled.originY) / sampled.spacing)}`;
          const others = cells.get(key) ?? [];

          for (const other of others) {
            const hasCrossing =
              orient(a, b, other.a) * orient(a, b, other.b) < -1e-12 &&
              orient(other.a, other.b, a) * orient(other.a, other.b, b) < -1e-12;

            assert.ok(
              !hasCrossing,
              `seed ${seed}: crossing elevations ${contour.elevation} and ${other.level} at ${key}`,
            );
          }

          others.push({ a, b, level: contour.elevation });
          cells.set(key, others);
        }
      }
    }
  }
});
