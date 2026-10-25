import { PNG } from 'pngjs';
import { validateDesignSettings } from './design-settings';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Resvg } from '@resvg/resvg-js';
import { createSeaLevelGeometry } from './sea-level';
import { createOutputRenderer } from './export/image-export';
import { engineConfiguration } from './constants/engine';
import { versionOneDesignDefaults } from './constants/design';
import type { RealTerrain } from './real-terrain';
import type { HeightField } from './types/terrain';

const terrain: RealTerrain = {
  sample: (x, _y, width) => (x / width - 0.5) * 1.6,
  attribution: 'Test elevation source',
  seaLevel: 0,
  seaLevelHatching: true,
};
const field: HeightField = {
  columns: 2,
  rows: 2,
  originX: 0,
  originY: 0,
  spacing: 10,
  values: new Float64Array([-1, 1, -1, 1]),
};

void test('sea-level fill clips mixed cells at the true threshold and reaches the frame', () => {
  const geometry = createSeaLevelGeometry(field, 10, 10, terrain);

  assert.ok(geometry);
  let area = 0;

  for (const polygon of geometry.polygons) {
    let twiceArea = 0;

    for (let index = 0; index < polygon.length; index++) {
      const a = polygon[index];
      const b = polygon[(index + 1) % polygon.length];

      assert.ok(a.x >= 0 && a.x <= 5 && a.y >= 0 && a.y <= 10);
      twiceArea += a.x * b.y - b.x * a.y;
    }

    area += Math.abs(twiceArea) / 2;
  }

  assert.equal(area, 50);
  assert.equal(createSeaLevelGeometry(field, 10, 10), undefined);
  assert.equal(
    createSeaLevelGeometry(field, 10, 10, { ...terrain, seaLevelHatching: false }),
    undefined,
  );
});

void test('flat sea-level plateaus fill while elevated terrain remains empty', () => {
  const plateau = { ...field, values: new Float64Array(4) };

  assert.equal(createSeaLevelGeometry(plateau, 10, 10, terrain)?.polygons.length, 1);
  assert.equal(
    createSeaLevelGeometry(plateau, 10, 10, { ...terrain, seaLevel: -1 })?.polygons.length,
    0,
  );
});

void test('SVG and PNG exports preserve sea-level hatching and toggle changes', () => {
  let activeTerrain = terrain;
  const renderer = createOutputRenderer(engineConfiguration, () => activeTerrain);
  const settings = {
    ...versionOneDesignDefaults,
    width: 100,
    height: 100,
    gridStyle: 'off' as const,
  };
  const validated = validateDesignSettings(settings);

  assert.ok(validated.ok);
  const svg = renderer.getSvg(validated.data);

  assert.match(svg, /data-sea-level="0"/);
  assert.match(svg, /patternUnits="userSpaceOnUse"/);
  assert.match(svg, /Test elevation source/);
  const png = new Resvg(svg).render().asPng();

  assert.ok(png.length > 100);
  activeTerrain = { ...terrain, seaLevelHatching: false };
  const plainSvg = renderer.getSvg(validated.data);

  assert.doesNotMatch(plainSvg, /data-sea-level/);
  const hatchedPixels = PNG.sync.read(png).data;
  const plainPixels = PNG.sync.read(new Resvg(plainSvg).render().asPng()).data;
  let changedBelowSeaLevel = 0;

  for (let y = 0; y < 100; y++) {
    for (let x = 0; x < 100; x++) {
      const offset = (y * 100 + x) * 4;
      const changed = !hatchedPixels
        .subarray(offset, offset + 4)
        .equals(plainPixels.subarray(offset, offset + 4));

      if (x > 51) {
        assert.equal(changed, false);
      } else if (x < 49 && changed) {
        changedBelowSeaLevel++;
      }
    }
  }

  assert.ok(changedBelowSeaLevel > 100);
});

void test('an inland elevated island remains a hole in the sea-level fill', () => {
  const island: HeightField = {
    columns: 3,
    rows: 3,
    originX: 0,
    originY: 0,
    spacing: 10,
    values: new Float64Array([-1, -1, -1, -1, 1, -1, -1, -1, -1]),
  };
  const geometry = createSeaLevelGeometry(island, 20, 20, terrain);

  assert.ok(geometry);
  const area = geometry.polygons.reduce((sum, polygon) => {
    let twiceArea = 0;

    for (let index = 0; index < polygon.length; index++) {
      const a = polygon[index];
      const b = polygon[(index + 1) % polygon.length];

      twiceArea += a.x * b.y - b.x * a.y;
    }

    return sum + Math.abs(twiceArea) / 2;
  }, 0);

  assert.equal(area, 325);
});
