import { downloadTerrainTile } from './terrain-tile-download';
import { bundledTerrainTileSources } from './constants/bundled-terrain-tiles';
import { terrariumTileSizePixels } from './constants/real-terrain';
import { loadRealTerrain as loadTerrainFromTiles } from './real-terrain';
import type { DecodedTerrainTile, RealTerrain, TerrainLoadProgressReporter } from './real-terrain';
import { TerrainLoadError } from './terrain-load-error';

/** Terrarium tiles are immutable; bump the version only if the cached format changes. */
// Legacy cache name kept across the landcube rename so existing data survives.
const terrainTileCacheName = 'topogra-terrain-tiles-v1';
const terrainTileKeyPattern = /\/terrarium\/(\d+\/\d+\/\d+)\.png$/;

/** Loads real terrain using browser image APIs while retaining shared sampling behaviour. */
export async function loadBrowserRealTerrain(
  latitude: number,
  longitude: number,
  spanKm: number,
  elevationFloor?: number,
  maxDepth?: number,
  options: BrowserTerrainLoadOptions = {},
): Promise<RealTerrain> {
  return loadTerrainFromTiles(
    latitude,
    longitude,
    spanKm,
    (tileUrl) => decodeBrowserTerrainTile(tileUrl, options.cancelSignal),
    elevationFloor,
    maxDepth,
    options.onProgress,
  );
}

export interface BrowserTerrainLoadOptions {
  /** Reports tiles as they finish: (0, total) first, then one call per tile. */
  onProgress?: TerrainLoadProgressReporter;
  /** Aborts in-flight downloads; tiles already cached stay cached. */
  cancelSignal?: AbortSignal;
}

/** Downloads and decodes a Terrarium tile through browser canvas APIs. */
async function decodeBrowserTerrainTile(
  tileUrl: string,
  cancelSignal: AbortSignal | undefined,
): Promise<DecodedTerrainTile> {
  const { response, imagerySources } = await fetchTerrainTile(tileUrl, cancelSignal);
  const bitmap = await createImageBitmap(await response.blob()).catch((error: unknown) => {
    throw new TerrainLoadError(
      'tileDecodeFailed',
      `Terrain tile could not be decoded (${tileUrl}). Retry, or choose another location.`,
      { cause: error },
    );
  });

  try {
    const canvas = document.createElement('canvas');

    canvas.width = canvas.height = terrariumTileSizePixels;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context) {
      throw new TerrainLoadError('tileDecodeFailed', 'Canvas is unavailable for terrain decoding.');
    }

    context.drawImage(bitmap, 0, 0);

    return {
      pixels: new Uint8Array(
        context.getImageData(0, 0, terrariumTileSizePixels, terrariumTileSizePixels).data,
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
  cancelSignal: AbortSignal | undefined,
): Promise<{ response: Response; imagerySources: string }> {
  const tileKey = terrainTileKeyPattern.exec(tileUrl)?.[1];
  const bundledSources = tileKey === undefined ? undefined : bundledTerrainTileSources[tileKey];

  if (tileKey !== undefined && bundledSources !== undefined) {
    const bundledUrl = new URL(`terrain-tiles/${tileKey}.png`, document.baseURI).href;

    try {
      const response = await downloadTerrainTile(bundledUrl, cancelSignal);

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

  const response = await fetchCachedTerrainTile(tileUrl, cancelSignal);

  return {
    response,
    imagerySources: response.headers.get('x-amz-meta-x-imagery-sources') ?? '',
  };
}

/** Serves tiles from Cache Storage when present, so revisited places load without the network. */
async function fetchCachedTerrainTile(
  tileUrl: string,
  cancelSignal: AbortSignal | undefined,
): Promise<Response> {
  const cache = await openTerrainTileCache();
  const cached = await cache?.match(tileUrl);

  if (cached) {
    return cached;
  }

  const response = await downloadTerrainTile(tileUrl, cancelSignal);

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
