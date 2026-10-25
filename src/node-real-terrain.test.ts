import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PNG } from 'pngjs';
import { loadNodeRealTerrain } from './node-real-terrain';

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
