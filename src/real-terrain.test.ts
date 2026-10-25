import assert from 'node:assert/strict';
import test from 'node:test';
import { validateDesignSettings } from './design-settings';
import type { RealTerrain, TerrainTileLoader } from './real-terrain';
import { decodeTerrariumElevation, loadRealTerrain } from './real-terrain';
import { createOutputRenderer } from './export/image-export';
import { engineConfiguration } from './constants/engine';
import { versionOneDesignDefaults } from './constants/design';
import { createGridMarkup } from './svg-rendering';

void test('Terrarium decoding preserves sea level, negative heights and fractional meters', () => {
  assert.equal(decodeTerrariumElevation(128, 0, 0), 0);
  assert.equal(decodeTerrariumElevation(127, 255, 128), -0.5);
  assert.equal(decodeTerrariumElevation(129, 10, 64), 266.25);
});

const terrainTilePixelCount = 256 * 256 * 4;

const unusedTileLoader: TerrainTileLoader = () =>
  Promise.reject(new Error('Tile loading should not occur for invalid bounds'));

void test('invalid geographic bounds fail before requesting tiles', async () => {
  await assert.rejects(loadRealTerrain(90, 0, 25, unusedTileLoader), /latitude/);
  await assert.rejects(loadRealTerrain(53, NaN, 25, unusedTileLoader), /longitude/);
  await assert.rejects(loadRealTerrain(53, -6, 0, unusedTileLoader), /2–200/);
});

void test('fixture-backed terrain uses decoded pixels, normalized sampling, and source attribution', async () => {
  const pixels = new Uint8Array(terrainTilePixelCount);

  for (let pixelOffset = 0; pixelOffset < pixels.length; pixelOffset += 4) {
    pixels[pixelOffset] = pixelOffset % 8 === 0 ? 128 : 129;
    pixels[pixelOffset + 3] = 255;
  }

  const terrain = await loadRealTerrain(53, -6, 25, () =>
    Promise.resolve({ pixels, imagerySources: 'eudem' }),
  );

  assert.match(terrain.attribution, /Copernicus/);
  assert.ok(terrain.sample(0, 0, 100, 100) >= -0.8);
  assert.ok(terrain.sample(100, 100, 100, 100) <= 0.8);
});

void test('grid options produce square and cross patterns and can be disabled', () => {
  assert.equal(createGridMarkup(100, 100, versionOneDesignDefaults), '');
  assert.match(
    createGridMarkup(100, 100, { ...versionOneDesignDefaults, gridStyle: 'squares' }),
    /M80,0H0V80/,
  );
  assert.match(
    createGridMarkup(100, 100, { ...versionOneDesignDefaults, gridStyle: 'crosses' }),
    /h8M40,36v8/,
  );
});

void test('exports invalidate cached geometry when switching terrain sources', () => {
  let activeTerrain: RealTerrain | undefined;
  const renderer = createOutputRenderer(engineConfiguration, () => activeTerrain);
  const result = validateDesignSettings({ ...versionOneDesignDefaults, width: 100, height: 100 });

  assert.equal(result.ok, true);
  const settings = result.data;
  const generated = renderer.getSvg(settings);

  activeTerrain = { sample: (x, _y, width) => x / width - 0.5, attribution: 'Test terrain' };
  const real = renderer.getSvg(settings);

  assert.notEqual(real, generated);
  assert.match(real, /Test terrain/);
  activeTerrain = undefined;
  assert.equal(renderer.getSvg(settings), generated);
});
