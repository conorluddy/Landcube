import { downloadTerrainTile } from './terrain-tile-download';
import { loadRealTerrain as loadTerrainFromTiles } from './real-terrain';
import type { DecodedTerrainTile, RealTerrain } from './real-terrain';

const terrainTileSizePixels = 256;
/** Terrarium tiles are immutable; bump the version only if the cached format changes. */
const terrainTileCacheName = 'topogra-terrain-tiles-v1';

/** Loads real terrain using browser image APIs while retaining shared sampling behaviour. */
export async function loadBrowserRealTerrain(
  latitude: number,
  longitude: number,
  spanKm: number,
  elevationFloor?: number,
  maxDepth?: number,
): Promise<RealTerrain> {
  return loadTerrainFromTiles(
    latitude,
    longitude,
    spanKm,
    decodeBrowserTerrainTile,
    elevationFloor,
    maxDepth,
  );
}

/** Downloads and decodes a Terrarium tile through browser canvas APIs. */
async function decodeBrowserTerrainTile(tileUrl: string): Promise<DecodedTerrainTile> {
  const response = await fetchCachedTerrainTile(tileUrl);

  const bitmap = await createImageBitmap(await response.blob());

  try {
    const canvas = document.createElement('canvas');

    canvas.width = canvas.height = terrainTileSizePixels;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context) {
      throw new Error('Canvas is unavailable for terrain decoding.');
    }

    context.drawImage(bitmap, 0, 0);

    return {
      pixels: new Uint8Array(
        context.getImageData(0, 0, terrainTileSizePixels, terrainTileSizePixels).data,
      ),
      imagerySources: response.headers.get('x-amz-meta-x-imagery-sources') ?? '',
    };
  } finally {
    bitmap.close();
  }
}

/** Serves tiles from Cache Storage when present, so revisited places load without the network. */
async function fetchCachedTerrainTile(tileUrl: string): Promise<Response> {
  const cache = await openTerrainTileCache();
  const cached = await cache?.match(tileUrl);

  if (cached) {
    return cached;
  }

  const response = await downloadTerrainTile(tileUrl);

  // Writing in the background keeps decoding off the cache's critical path.
  // A failed write only costs a re-download next time; the tile itself is fine.
  cache?.put(tileUrl, response.clone()).catch((error: unknown) => {
    console.warn(
      JSON.stringify({ event: 'terrain_tile_cache_failed', tileUrl, error: String(error) }),
    );
  });

  return response;
}

/** Undefined where Cache Storage is missing (insecure origins) or blocked (private browsing). */
async function openTerrainTileCache(): Promise<Cache | undefined> {
  if (!('caches' in globalThis)) {
    return undefined;
  }

  try {
    return await caches.open(terrainTileCacheName);
  } catch {
    return undefined;
  }
}
