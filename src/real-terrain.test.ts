import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import test from 'node:test';
import { validateDesignSettings } from './design-settings';
import type { RealTerrain, TerrainTileLoader } from './real-terrain';
import {
  boxFilterElevations,
  decodeTerrariumElevation,
  loadRealTerrain,
  selectTerrainZoom,
} from './real-terrain';
import {
  defaultNewTerrainDetail,
  getTerrainDetailProfile,
  maximumConcurrentTileRequests,
  maximumTerrainTileZoom,
} from './constants/terrain-detail';
import { getMercatorSpanFraction } from './real-terrain-projection';
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

void test('real terrain repairs isolated source spikes before calculating its range', async () => {
  const pixels = new Uint8Array(terrainTilePixelCount);

  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset] = 128;
  }

  const spike = (128 * 256 + 128) * 4;

  pixels[spike] = 135;
  pixels[spike + 1] = 40;
  const terrain = await loadRealTerrain(53.1203518, -9.7056319, 120, () =>
    Promise.resolve({ pixels, imagerySources: 'eudem' }),
  );

  assert.equal(terrain.elevations?.maximumMeters, 0);
  assert.equal(terrain.elevations.minimumMeters, 0);
});

const unusedTileLoader: TerrainTileLoader = () =>
  Promise.reject(new Error('Tile loading should not occur for invalid bounds'));

void test('invalid geographic bounds fail before requesting tiles', async () => {
  await assert.rejects(loadRealTerrain(90, 0, 25, unusedTileLoader), /latitude/);
  await assert.rejects(loadRealTerrain(53, NaN, 25, unusedTileLoader), /longitude/);
  await assert.rejects(loadRealTerrain(53, -6, 0, unusedTileLoader), /2–800/);
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

  await loadRealTerrain(
    latitude,
    longitude,
    spanKm,
    (tileUrl) => {
      requestedTileKeys.push(tileUrl.replace(/^.*\/terrarium\/|\.png$/g, ''));

      return Promise.resolve({
        pixels: new Uint8Array(terrainTilePixelCount),
        imagerySources: '',
      });
    },
    undefined,
    undefined,
    // A fresh studio visit opens at the default detail and design size.
    {
      detail: defaultNewTerrainDetail,
      frame: versionOneDesignDefaults,
      tileBudget: getTerrainDetailProfile(defaultNewTerrainDetail)?.tileBudget.browser,
    },
  );

  assert.deepEqual(requestedTileKeys.sort(), Object.keys(bundledTerrainTileSources).sort());

  for (const tileKey of requestedTileKeys) {
    await access(new URL(`../public/terrain-tiles/${tileKey}.png`, import.meta.url));
  }
});

const flatTileLoader: TerrainTileLoader = () =>
  Promise.resolve({ pixels: new Uint8Array(terrainTilePixelCount), imagerySources: 'eudem' });

void test('standard detail keeps the version-one zoom for every preset', () => {
  for (const preset of realTerrainPresets) {
    const spanFraction = getMercatorSpanFraction(preset.latitude, preset.spanKm);
    const legacy = Math.max(0, Math.min(14, Math.floor(Math.log2(2 / spanFraction))));

    for (const detail of [undefined, 'standard'] as const) {
      assert.equal(
        selectTerrainZoom(preset.latitude, preset.longitude, preset.spanKm, { detail }),
        legacy,
        preset.name,
      );
    }
  }
});

void test('higher detail fetches deeper zooms sized to the output frame', () => {
  const { latitude, longitude } = defaultRealTerrainPreset;
  const frame = { width: 1440, height: 900 };
  const standard = selectTerrainZoom(latitude, longitude, 8);
  const high = selectTerrainZoom(latitude, longitude, 8, { detail: 'high', frame });
  const max = selectTerrainZoom(latitude, longitude, 8, { detail: 'max', frame });

  assert.equal(standard, 12);
  assert.equal(high, 13);
  assert.equal(max, 15);
  assert.ok(
    selectTerrainZoom(latitude, longitude, 8, {
      detail: 'high',
      frame: { width: 480, height: 320 },
    }) < high,
  );
});

void test('tile budgets step the zoom down without dropping below standard', () => {
  const ireland = realTerrainPresets.find(({ name }) => name === 'Ireland');

  assert.ok(ireland);
  const { latitude, longitude, spanKm } = ireland;
  const frame = { width: 4096, height: 2560 };
  const generous = selectTerrainZoom(latitude, longitude, spanKm, {
    detail: 'max',
    frame,
    tileBudget: 10_000,
  });
  const tight = selectTerrainZoom(latitude, longitude, spanKm, {
    detail: 'max',
    frame,
    tileBudget: 16,
  });
  const none = selectTerrainZoom(latitude, longitude, spanKm, {
    detail: 'max',
    frame,
    tileBudget: 0,
  });

  assert.ok(tight < generous);
  assert.equal(none, selectTerrainZoom(latitude, longitude, spanKm));
});

void test('detail never requests zooms Terrarium does not serve', () => {
  assert.equal(
    selectTerrainZoom(46, 7, 2, { detail: 'max', frame: { width: 12288, height: 12288 } }),
    maximumTerrainTileZoom,
  );
});

void test('detail terrain carries its sampling while standard terrain stays version one', async () => {
  const standard = await loadRealTerrain(0, 0, 2, flatTileLoader);
  const high = await loadRealTerrain(0, 0, 2, flatTileLoader, undefined, undefined, {
    detail: 'high',
  });

  assert.equal(standard.detail, undefined);
  assert.equal(standard.sampling, undefined);
  assert.equal(high.detail, 'high');
  assert.deepEqual(high.sampling, getTerrainDetailProfile('high')?.sampling);
});

void test('box filtering averages full and partial edge blocks', () => {
  const filtered = boxFilterElevations(Float64Array.from([1, 3, 5, 7, 9, 11, 13, 15, 17]), 3, 3, 2);

  assert.equal(filtered.columns, 2);
  assert.equal(filtered.rows, 2);
  assert.deepEqual([...filtered.values], [5, 8, 14, 17]);
});

void test('tile downloads stay within the concurrency limit and credit in a stable order', async () => {
  let inFlight = 0;
  let peak = 0;
  let calls = 0;
  const attributions = new Set<string>();

  for (const reverse of [false, true]) {
    const loader: TerrainTileLoader = async () => {
      const call = calls++;

      inFlight++;
      peak = Math.max(peak, inFlight);
      // Later tiles finish first on one pass and last on the other.
      await new Promise((resolve) => setTimeout(resolve, reverse ? 20 - (call % 20) : call % 20));
      inFlight--;

      return {
        pixels: new Uint8Array(terrainTilePixelCount),
        imagerySources: call % 2 ? 'srtm' : 'eudem',
      };
    };

    const terrain = await loadRealTerrain(53, -8, 400, loader, undefined, undefined, {
      detail: 'high',
    });

    attributions.add(terrain.attribution);
  }

  assert.ok(calls > maximumConcurrentTileRequests * 2, `only ${calls.toString()} tiles`);
  assert.equal(peak, maximumConcurrentTileRequests);
  assert.equal(attributions.size, 1);
});
