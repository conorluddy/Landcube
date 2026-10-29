import { downloadTerrainTile } from './terrain-tile-download';
import { bundledTerrainTileSources } from './constants/bundled-terrain-tiles';
import { loadRealTerrain as loadTerrainFromTiles } from './real-terrain';
import type { DecodedTerrainTile, RealTerrain, RealTerrainDetailOptions } from './real-terrain';
import { getTerrainDetailProfile } from './constants/terrain-detail';

const terrainTileSizePixels = 256;
/** Terrarium tiles are immutable; bump the version only if the cached format changes. */
const terrainTileCacheName = 'topogra-terrain-tiles-v1';
const terrainTileKeyPattern = /\/terrarium\/(\d+\/\d+\/\d+)\.png$/;

/** Loads real terrain using browser image APIs while retaining shared sampling behaviour. */
export async function loadBrowserRealTerrain(
  latitude: number,
  longitude: number,
  spanKm: number,
  elevationFloor?: number,
  maxDepth?: number,
  options: Omit<RealTerrainDetailOptions, 'tileBudget'> = {},
): Promise<RealTerrain> {
  if (getTerrainDetailProfile(options.detail)) {
    requestPersistentTileStorage();
  }

  return loadTerrainFromTiles(
    latitude,
    longitude,
    spanKm,
    decodeBrowserTerrainTile,
    elevationFloor,
    maxDepth,
    { ...options, tileBudget: getTerrainDetailProfile(options.detail)?.tileBudget.browser },
  );
}

let persistentStorageRequested = false;

/**
 * Detail loads cache many more tiles; persistent storage asks the browser not to evict them.
 * Best effort: browsers may decline or never prompt, and the cache still works either way.
 */
function requestPersistentTileStorage(): void {
  // Older browsers, insecure origins and test runtimes lack the Storage API altogether.
  if (
    persistentStorageRequested ||
    !('storage' in navigator) ||
    !('persist' in navigator.storage)
  ) {
    return;
  }

  persistentStorageRequested = true;
  navigator.storage.persist().catch(() => false);
}

/** Downloads and decodes a Terrarium tile through browser canvas APIs. */
async function decodeBrowserTerrainTile(tileUrl: string): Promise<DecodedTerrainTile> {
  const { response, imagerySources } = await fetchTerrainTile(tileUrl);

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
      imagerySources,
    };
  } finally {
    bitmap.close();
  }
}

/** The default location ships with the site, so the studio opens without tile downloads. */
async function fetchTerrainTile(
  tileUrl: string,
): Promise<{ response: Response; imagerySources: string }> {
  const tileKey = terrainTileKeyPattern.exec(tileUrl)?.[1];
  const bundledSources = tileKey === undefined ? undefined : bundledTerrainTileSources[tileKey];

  if (tileKey !== undefined && bundledSources !== undefined) {
    const bundledUrl = new URL(`terrain-tiles/${tileKey}.png`, document.baseURI).href;

    try {
      const response = await downloadTerrainTile(bundledUrl);

      // Static hosts can answer a missing file with their HTML page and a 200 status.
      if (response.headers.get('content-type')?.startsWith('image/png') !== true) {
        throw new Error(`Bundled tile ${bundledUrl} is not a PNG.`);
      }

      return { response, imagerySources: bundledSources };
    } catch (error) {
      // A host that drops the bundled files still has the public tile service to fall back on.
      console.warn(
        JSON.stringify({ event: 'bundled_terrain_tile_failed', tileUrl, error: String(error) }),
      );
    }
  }

  const response = await fetchCachedTerrainTile(tileUrl);

  return {
    response,
    imagerySources: response.headers.get('x-amz-meta-x-imagery-sources') ?? '',
  };
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
