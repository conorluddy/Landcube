import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access } from 'node:fs/promises';
import test from 'node:test';
import { validateDesignSettings } from './design-settings';
import type { RealTerrain, TerrainTileLoader } from './real-terrain';
import type { TerrainLoadError } from './terrain-load-error';
import { creditTerrainSources, decodeTerrariumElevation, loadRealTerrain } from './real-terrain';
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
import { locateRealTerrainFramePoint } from './real-terrain-projection';
import type { GeoPoint, SourceElevationSampler } from './types/terrain-analysis';

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
  await assert.rejects(loadRealTerrain(53, -6, 0, unusedTileLoader), /2–200/);
});

void test('tile progress reports 0 of N, then each finished tile', async () => {
  const pixels = new Uint8Array(terrainTilePixelCount);
  const reports: [number, number][] = [];

  await loadRealTerrain(
    53.1203518,
    -9.7056319,
    120,
    () => Promise.resolve({ pixels, imagerySources: 'eudem' }),
    undefined,
    undefined,
    (loadedTiles, totalTiles) => reports.push([loadedTiles, totalTiles]),
  );

  const totalTiles = reports[0][1];

  assert.deepEqual(reports[0], [0, totalTiles]);
  assert.equal(reports.length, totalTiles + 1);
  assert.deepEqual(reports.at(-1), [totalTiles, totalTiles]);
  assert.ok(reports.every(([, total]) => total === totalTiles));
});

void test('out-of-range locations and bad tiles carry a fault kind', async () => {
  await assert.rejects(
    loadRealTerrain(90, 0, 25, unusedTileLoader),
    (error: TerrainLoadError) => error.kind === 'locationOutOfRange',
  );
  await assert.rejects(
    loadRealTerrain(53, -6, 25, () =>
      Promise.resolve({ pixels: new Uint8Array(4), imagerySources: '' }),
    ),
    (error: TerrainLoadError) => error.kind === 'tileDecodeFailed',
  );
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
    await access(new URL(`../public/terrain-tiles/${tileKey}.png`, import.meta.url));
  }
});

// === SOURCE ELEVATIONS ===

/** Serves one tile everywhere, so a sample's tile-local column and row fix its height. */
function createTileLoader(elevationAt: (column: number, row: number) => number): TerrainTileLoader {
  const pixels = new Uint8Array(terrainTilePixelCount);

  for (let row = 0; row < 256; row++) {
    for (let column = 0; column < 256; column++) {
      const encoded = elevationAt(column, row) + 32768;
      const offset = (row * 256 + column) * 4;

      pixels[offset] = Math.floor(encoded / 256);
      pixels[offset + 1] = Math.floor(encoded % 256);
      pixels[offset + 2] = Math.round((encoded % 1) * 256);
      pixels[offset + 3] = 255;
    }
  }

  return () => Promise.resolve({ pixels, imagerySources: 'srtm' });
}

/** Seabed to hills with a 2500 m spike at (200, 40) that preprocessing repairs. */
const mixedTileLoader = createTileLoader((column, row) =>
  column === 200 && row === 40 ? 2500 : (column - 128) * 3 + (row % 17) + (column % 5) / 4,
);
const floorCases: [number | undefined, number | undefined][] = [
  [undefined, undefined],
  [100, undefined],
  [undefined, 50],
  [-20, 100],
  [undefined, 0],
];

/** A 2 km patch at (0, 0) loads zoom-14 tiles 8191–8192 on both axes; grid sample 256 sits on (0, 0). */
function locateEquatorGridSample(column: number, row: number): GeoPoint {
  const tileCount = 2 ** 14;
  const mercatorY = (8191 + row / 256) / tileCount;

  return {
    latitude: (Math.atan(Math.sinh(Math.PI * (1 - 2 * mercatorY))) * 180) / Math.PI,
    longitude: ((8191 + column / 256) / tileCount) * 360 - 180,
  };
}

function requireSourceElevations(terrain: RealTerrain): SourceElevationSampler {
  assert.ok(terrain.sourceElevations, 'Real terrain should carry source elevations.');

  return terrain.sourceElevations;
}

function assertNear(actual: number | undefined, expected: number, tolerance = 1e-6) {
  assert.ok(
    actual !== undefined && Math.abs(actual - expected) < tolerance,
    `Expected ${expected} within ${tolerance}, got ${actual}.`,
  );
}

void test('legacy sampling and ranges stay byte-identical with the floor applied on read', async () => {
  const values: number[] = [];
  const placements = [
    [0, 0, 2],
    [53.12, -9.7, 25],
    [-41.3, 174.8, 120],
  ];

  for (const [latitude, longitude, spanKm] of placements) {
    for (const [floor, depth] of floorCases) {
      const terrain = await loadRealTerrain(
        latitude,
        longitude,
        spanKm,
        mixedTileLoader,
        floor,
        depth,
      );
      const { minimumMeters, maximumMeters, originMeters, metersPerUnit } =
        terrain.elevations ?? {};

      values.push(terrain.seaLevel ?? NaN, minimumMeters ?? NaN, maximumMeters ?? NaN);
      values.push(originMeters ?? NaN, metersPerUnit ?? NaN);

      for (let y = -10; y <= 90; y += 2.5) {
        for (let x = -10; x <= 110; x += 2.5) {
          values.push(terrain.sample(x, y, 100, 80));
        }
      }
    }
  }

  // Digest of the same values from the in-place clipping algorithm this replaced.
  assert.equal(
    createHash('sha256').update(new Float64Array(values)).digest('hex'),
    '6790c11561d164dd344ed905683d096d1542cfe8bc479dc003677e16ccbdebab',
  );
});

void test('source metres ignore the elevation floor and maximum depth, even below the floor', async () => {
  const loads = await Promise.all(
    floorCases.map(([floor, depth]) => loadRealTerrain(0, 0, 2, mixedTileLoader, floor, depth)),
  );
  const points = Array.from({ length: 64 }, (_, index) =>
    locateEquatorGridSample(40 + index * 7.3, 30 + index * 6.1),
  );
  const unclipped = points.map((point) => requireSourceElevations(loads[0]).sampleMeters(point));

  assert.ok(unclipped.some((meters) => meters !== undefined && meters < -100));

  for (const terrain of loads.slice(1)) {
    assert.deepEqual(
      points.map((point) => requireSourceElevations(terrain).sampleMeters(point)),
      unclipped,
    );
    assert.notEqual(terrain.sample(0, 50, 100, 100), loads[0].sample(0, 50, 100, 100));
  }
});

void test('source metres read the repaired grid rather than raw spikes', async () => {
  const terrain = await loadRealTerrain(0, 0, 2, mixedTileLoader);
  const spikeMeters = requireSourceElevations(terrain).sampleMeters(
    locateEquatorGridSample(200, 40),
  );

  assertNear(spikeMeters, (200 - 128) * 3, 20);
});

void test('source metres interpolate bilinearly between grid samples', async () => {
  const terrain = await loadRealTerrain(
    0,
    0,
    2,
    createTileLoader((column, row) => 100 + column + 2 * row),
  );
  const sampler = requireSourceElevations(terrain);

  assert.equal(sampler.sampleMeters({ latitude: 0, longitude: 0 }), 100);
  assertNear(sampler.sampleMeters(locateEquatorGridSample(256.5, 256)), 100.5);
  assertNear(sampler.sampleMeters(locateEquatorGridSample(256.5, 256.5)), 101.5);
  assertNear(sampler.sampleMeters(locateEquatorGridSample(10.25, 300)), 198.25);
});

void test('source metres are unavailable rather than zero outside the loaded coverage', async () => {
  const terrain = await loadRealTerrain(
    0,
    0,
    2,
    createTileLoader(() => 0),
  );
  const sampler = requireSourceElevations(terrain);
  const { north, south, east, west } = sampler.coverage;
  const inset = 1e-7;

  assert.equal(sampler.sampleMeters({ latitude: north - inset, longitude: west + inset }), 0);
  assert.equal(sampler.sampleMeters({ latitude: south + inset, longitude: east - inset }), 0);
  assert.equal(sampler.sampleMeters({ latitude: north + 0.001, longitude: 0 }), undefined);
  assert.equal(sampler.sampleMeters({ latitude: 0, longitude: east + 0.001 }), undefined);
  assert.equal(sampler.sampleMeters({ latitude: 10, longitude: 10 }), undefined);
  assert.equal(sampler.sampleMeters({ latitude: NaN, longitude: 0 }), undefined);
  assert.equal(sampler.sampleMeters({ latitude: 0, longitude: Infinity }), undefined);
  assert.equal(sampler.sampleMeters({ latitude: 95, longitude: 0 }), undefined);
  // Zoom-14 equator pixels are 1 / 2^22 of the circumference apart.
  assertNear(sampler.resolutionMeters, 40075016.686 / 2 ** 22, 1e-9);
});

void test('polar patches report no source metres beyond the Mercator world edge', async () => {
  const terrain = await loadRealTerrain(
    85,
    0,
    200,
    createTileLoader(() => 40),
  );
  const sampler = requireSourceElevations(terrain);

  assert.ok(sampler.coverage.north < 85.0512);
  assert.equal(sampler.sampleMeters({ latitude: 85, longitude: 0 }), 40);
  assert.equal(sampler.sampleMeters({ latitude: 85.06, longitude: 0 }), undefined);
});

void test('source metres agree with frame sampling at the same place, even on a copied terrain', async () => {
  const terrain = await loadRealTerrain(53.12, -9.7, 25, mixedTileLoader);
  const copiedTerrain = { ...terrain };
  const { originMeters = NaN, metersPerUnit = NaN } = terrain.elevations ?? {};
  const frame = { width: 100, height: 80 };

  for (let y = 0; y <= 80; y += 7) {
    for (let x = 0; x <= 100; x += 9) {
      const place = locateRealTerrainFramePoint(
        { location: { latitude: 53.12, longitude: -9.7 }, spanKm: 25 },
        { x, y },
        frame,
      );
      const meters = requireSourceElevations(copiedTerrain).sampleMeters(place) ?? NaN;

      assertNear((meters - originMeters) / metersPerUnit, terrain.sample(x, y, 100, 80), 1e-9);
    }
  }
});

void test('source revision is stable for identical loads and changes with every load input', async () => {
  const load = (
    latitude: number,
    longitude: number,
    spanKm: number,
    floor?: number,
    depth?: number,
  ) =>
    loadRealTerrain(latitude, longitude, spanKm, mixedTileLoader, floor, depth).then(
      (terrain) => requireSourceElevations(terrain).revision,
    );
  const base = await load(0, 0, 2);
  const variants = await Promise.all([
    load(0.01, 0, 2),
    load(0, 0.01, 2),
    load(0, 0, 3),
    load(0, 0, 2, 10),
    load(0, 0, 2, undefined, 10),
  ]);

  assert.equal(await load(0, 0, 2), base);
  assert.equal(new Set([base, ...variants]).size, variants.length + 1);
});

void test('a tile is credited for each source family named in its imagery header', () => {
  assert.deepEqual(creditTerrainSources('eudem/eudem_dem_5deg_n55w010.tif'), [
    'Produced using Copernicus data and information funded by the European Union — EU-DEM layers',
  ]);
  assert.equal(creditTerrainSources('srtm/N55W009.hgt, etopo1/x.tif').length, 2);
});

void test('a tile with no imagery header credits every source, since any could apply', () => {
  assert.ok(creditTerrainSources('').length > 5);
});
