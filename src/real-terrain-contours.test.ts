import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getRealContourElevations,
  getRealContourInterval,
  validateRealContourInterval,
} from './real-terrain-contours';
import { calculateContourElevations, generateLandscapeGeometry } from './landscape-composition';
import { engineConfiguration } from './constants/engine';
import { versionOneDesignDefaults } from './constants/design';
import { createTerrainLineBuffers } from './terrain-3d-lines';
import { createSvgDocument } from './svg-rendering';
import type { RealTerrain } from './real-terrain';

const terrain = {
  attribution: 'Fixture',
  contourInterval: 25,
  elevations: { minimumMeters: -45, maximumMeters: 535, originMeters: 213, metersPerUnit: 500 },
  sample: (x: number, _y: number, width: number) => ((x / width) * 580 - 45 - 213) / 500,
} satisfies RealTerrain;

void test('fixed contour levels are round meter multiples anchored across sea level', () => {
  const levels = getRealContourElevations(terrain) ?? [];
  const meters = levels.map((value) => Math.round(value * 500 + 213));

  assert.deepEqual(
    meters,
    Array.from({ length: 23 }, (_, i) => -25 + i * 25),
  );
  assert.equal(getRealContourInterval(terrain), 25);
  assert.deepEqual(
    calculateContourElevations(versionOneDesignDefaults, engineConfiguration, terrain),
    levels,
  );
});

void test('Auto uses readable intervals, independently of decorative density', () => {
  const auto = { ...terrain, contourInterval: 'auto' as const };

  assert.equal(getRealContourInterval(auto), 20);
  assert.deepEqual(
    calculateContourElevations(
      { ...versionOneDesignDefaults, contourCount: 9 },
      engineConfiguration,
      auto,
    ),
    calculateContourElevations(
      { ...versionOneDesignDefaults, contourCount: 99 },
      engineConfiguration,
      auto,
    ),
  );
  assert.equal(
    getRealContourInterval({ ...auto, elevations: { ...terrain.elevations, maximumMeters: 5350 } }),
    200,
  );
});

void test('legacy real terrain and generated terrain retain version-one density levels', () => {
  const expected = calculateContourElevations(versionOneDesignDefaults, engineConfiguration);

  for (const contourInterval of [undefined, 'density'] as const) {
    assert.deepEqual(
      calculateContourElevations(versionOneDesignDefaults, engineConfiguration, {
        ...terrain,
        contourInterval,
      }),
      expected,
    );
  }
});

void test('flat and below-sea-level areas have finite bounded physical levels', () => {
  assert.deepEqual(
    getRealContourElevations({
      ...terrain,
      elevations: { ...terrain.elevations, minimumMeters: 10, maximumMeters: 10 },
    }),
    [],
  );
  assert.deepEqual(
    getRealContourElevations({
      ...terrain,
      elevations: { ...terrain.elevations, minimumMeters: -50, maximumMeters: -50 },
    }),
    [(-50 - 213) / 500],
  );

  for (const value of [0, -1, NaN, Infinity, 5001, 'fixed', null]) {
    assert.throws(() => {
      validateRealContourInterval(value);
    }, /Contour interval/);
  }

  assert.throws(
    () =>
      getRealContourInterval({
        ...terrain,
        contourInterval: 1,
        elevations: { ...terrain.elevations, minimumMeters: -11000, maximumMeters: 8900 },
      }),
    /too small/,
  );
});

void test('SVG and 3D emphasize physical elevations while retaining normalized geometry heights', () => {
  const settings = {
    ...versionOneDesignDefaults,
    width: 100,
    height: 100,
    indexEvery: 5,
    indexStrokeWidth: 2,
    indexStyle: 'solid' as const,
  };
  const { contours } = generateLandscapeGeometry(settings, engineConfiguration, terrain);
  const indexContours = contours.filter((contour) => (contour.elevationMeters ?? NaN) % 125 === 0);
  const groups = createTerrainLineBuffers(contours, 100, 100, settings);
  const svg = createSvgDocument(contours, settings);
  const indexPath = [...svg.matchAll(/<path[^>]*>/g)]
    .map(([value]) => value)
    .find((value) => value.includes(`stroke-width="${settings.indexStrokeWidth}"`));

  assert.ok(indexPath !== undefined);

  assert.equal(indexContours.length, 5);
  assert.ok(groups.solid.positions.length > 0);
  assert.match(svg, /data-contour-interval-m="25"/);

  for (const contour of indexContours) {
    assert.ok(Math.abs(contour.elevation * 500 + 213 - (contour.elevationMeters ?? NaN)) < 1e-8);
    assert.ok(contour.paths.length > 0);
    const point = contour.paths[0].points[0];

    assert.ok(indexPath.includes(`M${point.x.toFixed(3)},${point.y.toFixed(3)}`));
  }
});
