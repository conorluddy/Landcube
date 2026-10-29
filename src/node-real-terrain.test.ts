import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { getTerrainTileCacheDirectory, loadNodeRealTerrain } from './node-real-terrain';

// Fixtures must never read or fill the user's real tile cache.
process.env.TOPOGRA_TILE_CACHE = 'off';

/** Encodes a small deterministic Terrarium fixture as a valid 256px PNG tile. */
function createTerrainTileFixture(): Buffer {
  const png = new PNG({ width: 256, height: 256 });

  for (let pixelOffset = 0; pixelOffset < png.data.length; pixelOffset += 4) {
    png.data[pixelOffset] = pixelOffset % 8 === 0 ? 128 : 129;
    png.data[pixelOffset + 3] = 255;
  }

  return PNG.sync.write(png);
}

void test('Node terrain adapter decodes PNG fixtures without DOM image APIs', async (context) => {
  const tile = createTerrainTileFixture();

  context.mock.method(globalThis, 'fetch', () =>
    Promise.resolve(
      new Response(new Uint8Array(tile), { headers: { 'x-amz-meta-x-imagery-sources': 'eudem' } }),
    ),
  );
  const terrain = await loadNodeRealTerrain(53, -6, 25);

  assert.match(terrain.attribution, /Copernicus/);
  assert.ok(Number.isFinite(terrain.sample(50, 50, 100, 100)));
});

void test('cached tiles and their credits serve repeat loads without the network', async (context) => {
  const tile = createTerrainTileFixture();
  const directory = await mkdtemp(join(tmpdir(), 'topogra-tiles-'));
  const fetchMock = context.mock.method(globalThis, 'fetch', () =>
    Promise.resolve(
      new Response(new Uint8Array(tile), { headers: { 'x-amz-meta-x-imagery-sources': 'srtm' } }),
    ),
  );

  process.env.TOPOGRA_TILE_CACHE = directory;

  try {
    const first = await loadNodeRealTerrain(53, -6, 25);
    const downloads = fetchMock.mock.callCount();

    assert.ok(downloads > 0);
    assert.ok((await readdir(join(directory, 'terrarium'))).length > 0);

    const second = await loadNodeRealTerrain(53, -6, 25);

    assert.equal(fetchMock.mock.callCount(), downloads);
    assert.equal(second.attribution, first.attribution);
    assert.match(second.attribution, /Geological Survey/);
    assert.equal(second.sample(50, 50, 100, 100), first.sample(50, 50, 100, 100));
  } finally {
    process.env.TOPOGRA_TILE_CACHE = 'off';
  }
});

void test('the tile cache follows the override, XDG and home directories in that order', () => {
  assert.equal(getTerrainTileCacheDirectory({ TOPOGRA_TILE_CACHE: 'off' }), undefined);
  assert.equal(getTerrainTileCacheDirectory({ TOPOGRA_TILE_CACHE: '/tiles' }), '/tiles');
  assert.equal(
    getTerrainTileCacheDirectory({ XDG_CACHE_HOME: '/xdg' }),
    join('/xdg', 'topogra', 'terrain-tiles'),
  );
  assert.match(getTerrainTileCacheDirectory({}) ?? '', /\.cache[\\/]topogra[\\/]terrain-tiles$/);
});
