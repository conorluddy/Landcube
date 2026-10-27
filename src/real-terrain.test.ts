import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import test from 'node:test';
import { validateDesignSettings } from './design-settings';
import type { RealTerrain, TerrainTileLoader } from './real-terrain';
import { decodeTerrariumElevation, loadRealTerrain } from './real-terrain';
import { createOutputRenderer } from './export/image-export';
import { engineConfiguration } from './constants/engine';
import { bundledTerrainTileSources } from './constants/bundled-terrain-tiles';
import {
  defaultRealTerrainPreset,
  realTerrainBounds,
  realTerrainPresets,
  realTerrainSpanStopsKm,
} from './constants/real-terrain';
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

void test('elevation floors flatten low terrain while preserving legacy sampling when omitted', async () => {
  const pixels = new Uint8Array(terrainTilePixelCount);

  for (let offset = 0; offset < pixels.length; offset += 4) {
    const elevation = (offset / 4) % 256 < 128 ? -50 : 300;
    const encoded = elevation + 32768;

    pixels[offset] = Math.floor(encoded / 256);
    pixels[offset + 1] = encoded % 256;
    pixels[offset + 3] = 255;
  }

  const loader: TerrainTileLoader = () => Promise.resolve({ pixels, imagerySources: 'srtm' });
  const legacy = await loadRealTerrain(0, 0, 2, loader);
  const omitted = await loadRealTerrain(0, 0, 2, loader, undefined);
  const flat = await loadRealTerrain(0, 0, 2, loader, 400);

  for (const x of [0, 25, 50, 75, 100]) {
    assert.equal(legacy.sample(x, 50, 100, 100), omitted.sample(x, 50, 100, 100));
    assert.equal(flat.sample(x, 50, 100, 100), -0.8);
  }

  assert.equal(flat.attribution, legacy.attribution);
  await assert.rejects(loadRealTerrain(0, 0, 2, loader, NaN), /Elevation floor/);
  await assert.rejects(loadRealTerrain(0, 0, 2, loader, 9000), /Elevation floor/);
});

void test('Slieve League coastal fixture loses low-elevation source steps with an explicit floor', async () => {
  const { readFile } = await import('node:fs/promises');
  const fixture = JSON.parse(await readFile('tests/fixtures/slieve-league-coast.json', 'utf8')) as {
    elevations: number[][];
    imagerySources: string;
  };
  const pixels = new Uint8Array(terrainTilePixelCount);
  const heights = fixture.elevations.flat();
  const maximum = Math.max(...heights);

  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const elevation =
        fixture.elevations[y % fixture.elevations.length][x % fixture.elevations[0].length];
      const encoded = elevation + 32768;
      const offset = (y * 256 + x) * 4;

      pixels[offset] = Math.floor(encoded / 256);
      pixels[offset + 1] = Math.floor(encoded % 256);
      pixels[offset + 2] = Math.round((encoded % 1) * 256);
      pixels[offset + 3] = 255;
    }
  }

  const loader: TerrainTileLoader = () =>
    Promise.resolve({ pixels, imagerySources: fixture.imagerySources });
  const legacy = await loadRealTerrain(54.65, -8.7, 8, loader);
  const clipped = await loadRealTerrain(54.65, -8.7, 8, loader, maximum);
  const partial = await loadRealTerrain(54.65, -8.7, 8, loader, 150);
  const partialSamples = Array.from({ length: 100 }, (_, x) => partial.sample(x, 50, 100, 100));

  assert.ok(partialSamples.some((height) => height === -0.8));
  assert.ok(partialSamples.some((height) => height > 0));

  const samples = Array.from({ length: 100 }, (_, x) => legacy.sample(x, 50, 100, 100));

  assert.ok(Math.max(...samples) - Math.min(...samples) > 0.5);

  for (let x = 0; x < 100; x++) {
    assert.equal(clipped.sample(x, 50, 100, 100), -0.8);
  }
});

void test('maximum depth clips bathymetry and combines with an above-sea elevation floor', async () => {
  const pixels = new Uint8Array(terrainTilePixelCount);

  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const height = x < 64 ? -200 : x < 128 ? -50 : x < 192 ? 0 : 200;
      const encoded = height + 32768;
      const offset = (y * 256 + x) * 4;

      pixels[offset] = Math.floor(encoded / 256);
      pixels[offset + 1] = encoded % 256;
      pixels[offset + 3] = 255;
    }
  }

  const loader: TerrainTileLoader = () => Promise.resolve({ pixels, imagerySources: 'srtm' });
  const legacy = await loadRealTerrain(0, 0, 2, loader);
  const seaLevel = await loadRealTerrain(0, 0, 2, loader, undefined, 0);
  const hundred = await loadRealTerrain(0, 0, 2, loader, undefined, 100);
  const unlimited = await loadRealTerrain(0, 0, 2, loader, undefined, 11000);
  const combined = await loadRealTerrain(0, 0, 2, loader, 250, 100);

  assert.equal(seaLevel.seaLevel, -0.8);
  assert.equal(legacy.seaLevel, 0);
  assert.ok(Math.abs((hundred.seaLevel ?? Infinity) - (-0.5 + 1 / 3) * 1.6) < 1e-12);
  assert.equal(seaLevel.sample(90, 50, 100, 100), -0.8);
  assert.ok(hundred.sample(90, 50, 100, 100) > -0.8);

  for (let x = 0; x < 100; x++) {
    assert.equal(unlimited.sample(x, 50, 100, 100), legacy.sample(x, 50, 100, 100));
    assert.equal(combined.sample(x, 50, 100, 100), -0.8);
  }

  await assert.rejects(loadRealTerrain(0, 0, 2, loader, undefined, -1), /Maximum depth/);
  await assert.rejects(loadRealTerrain(0, 0, 2, loader, undefined, Infinity), /Maximum depth/);
});

void test('terrain presets have unique names, valid coordinates and slider spans', () => {
  const names = realTerrainPresets.map(({ name }) => name.toLowerCase());
  const spanStops: readonly number[] = realTerrainSpanStopsKm;

  assert.equal(new Set(names).size, names.length, 'CLI lookup ignores case, so names must differ');

  for (const preset of realTerrainPresets) {
    assert.ok(
      preset.latitude >= realTerrainBounds.minimumLatitude &&
        preset.latitude <= realTerrainBounds.maximumLatitude,
      `${preset.name} latitude ${preset.latitude}`,
    );
    assert.ok(
      preset.longitude >= realTerrainBounds.minimumLongitude &&
        preset.longitude <= realTerrainBounds.maximumLongitude,
      `${preset.name} longitude ${preset.longitude}`,
    );
    assert.ok(spanStops.includes(preset.spanKm), `${preset.name} span ${preset.spanKm} km`);
  }
});

void test('span slider stops ascend across the full allowed span range', () => {
  assert.equal(realTerrainSpanStopsKm[0], realTerrainBounds.minimumSpanKm);
  assert.equal(realTerrainSpanStopsKm.at(-1), realTerrainBounds.maximumSpanKm);

  for (let index = 1; index < realTerrainSpanStopsKm.length; index++) {
    assert.ok(realTerrainSpanStopsKm[index] > realTerrainSpanStopsKm[index - 1]);
  }
});

void test('studio opens on Errigal while the preset list keeps Wicklow first', () => {
  assert.equal(defaultRealTerrainPreset.name, 'Errigal');
  assert.equal(realTerrainPresets[0].name, 'Wicklow Mountains');
});

void test('bundled tiles cover exactly the default location and exist on disk', async () => {
  const requestedTileKeys: string[] = [];
  const { latitude, longitude, spanKm } = defaultRealTerrainPreset;

  await loadRealTerrain(latitude, longitude, spanKm, (tileUrl) => {
    requestedTileKeys.push(tileUrl.replace(/^.*\/terrarium\/|\.png$/g, ''));

    return Promise.resolve({
      pixels: new Uint8Array(terrainTilePixelCount),
      imagerySources: '',
    });
  });

  assert.deepEqual(requestedTileKeys.sort(), Object.keys(bundledTerrainTileSources).sort());

  for (const tileKey of requestedTileKeys) {
    await access(`public/terrain-tiles/${tileKey}.png`);
  }
});
