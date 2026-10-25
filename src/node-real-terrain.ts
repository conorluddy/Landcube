import { downloadTerrainTile } from './terrain-tile-download';
import { PNG } from 'pngjs';
import { loadRealTerrain as loadTerrainFromTiles } from './real-terrain';
import type { DecodedTerrainTile, RealTerrain } from './real-terrain';

const terrainTileSizePixels = 256;

/** Loads real terrain in Node without DOM canvas or image globals. */
export async function loadNodeRealTerrain(
  latitude: number,
  longitude: number,
  spanKm: number,
): Promise<RealTerrain> {
  return loadTerrainFromTiles(latitude, longitude, spanKm, decodeNodeTerrainTile);
}

/** Fetches and decodes a PNG Terrarium tile using a pure Node PNG decoder. */
async function decodeNodeTerrainTile(tileUrl: string): Promise<DecodedTerrainTile> {
  const response = await downloadTerrainTile(tileUrl);

  const png = PNG.sync.read(Buffer.from(await response.arrayBuffer()));

  if (png.width !== terrainTileSizePixels || png.height !== terrainTileSizePixels) {
    throw new Error('Terrain tile has unexpected dimensions.');
  }

  return {
    pixels: png.data,
    imagerySources: response.headers.get('x-amz-meta-x-imagery-sources') ?? '',
  };
}
