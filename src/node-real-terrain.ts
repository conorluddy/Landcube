import { downloadTerrainTile } from './terrain-tile-download';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { PNG } from 'pngjs';
import { loadRealTerrain as loadTerrainFromTiles } from './real-terrain';
import type { DecodedTerrainTile, RealTerrain, RealTerrainDetailOptions } from './real-terrain';
import { getTerrainDetailProfile } from './constants/terrain-detail';

const terrainTileSizePixels = 256;
const terrainTileKeyPattern = /\/terrarium\/(\d+\/\d+\/\d+)\.png$/;

/** Loads real terrain in Node without DOM canvas or image globals. */
export async function loadNodeRealTerrain(
  latitude: number,
  longitude: number,
  spanKm: number,
  elevationFloor?: number,
  maxDepth?: number,
  options: Omit<RealTerrainDetailOptions, 'tileBudget'> = {},
): Promise<RealTerrain> {
  return loadTerrainFromTiles(
    latitude,
    longitude,
    spanKm,
    decodeNodeTerrainTile,
    elevationFloor,
    maxDepth,
    { ...options, tileBudget: getTerrainDetailProfile(options.detail)?.tileBudget.node },
  );
}

/**
 * Where downloaded tiles persist between runs; undefined when `TOPOGRA_TILE_CACHE=off`.
 * Terrarium tiles are immutable, so cached tiles never expire.
 */
export function getTerrainTileCacheDirectory(
  environment: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const configured = environment.TOPOGRA_TILE_CACHE;

  if (configured === 'off') {
    return undefined;
  }

  if (configured !== undefined && configured !== '') {
    return configured;
  }

  const cacheHome =
    environment.XDG_CACHE_HOME !== undefined && environment.XDG_CACHE_HOME !== ''
      ? environment.XDG_CACHE_HOME
      : join(homedir(), '.cache');

  return join(cacheHome, 'topogra', 'terrain-tiles');
}

/** Fetches and decodes a PNG Terrarium tile using a pure Node PNG decoder. */
async function decodeNodeTerrainTile(tileUrl: string): Promise<DecodedTerrainTile> {
  const { bytes, imagerySources } = await fetchCachedTerrainTile(tileUrl);
  const png = PNG.sync.read(bytes);

  if (png.width !== terrainTileSizePixels || png.height !== terrainTileSizePixels) {
    throw new Error('Terrain tile has unexpected dimensions.');
  }

  return { pixels: png.data, imagerySources };
}

/** Reads a stored tile before any request, so repeat renders cost the tile host nothing. */
async function fetchCachedTerrainTile(
  tileUrl: string,
): Promise<{ bytes: Buffer; imagerySources: string }> {
  const directory = getTerrainTileCacheDirectory();
  const tileKey = terrainTileKeyPattern.exec(tileUrl)?.[1];
  const tilePath =
    directory === undefined || tileKey === undefined
      ? undefined
      : join(directory, 'terrarium', `${tileKey}.png`);

  if (tilePath !== undefined) {
    try {
      // The credit sidecar is written first, so a readable tile always has its sources.
      const [bytes, imagerySources] = await Promise.all([
        readFile(tilePath),
        readFile(`${tilePath}.sources`, 'utf8'),
      ]);

      return { bytes, imagerySources };
    } catch {
      // A missing or partial entry is a cache miss; the download below replaces it.
    }
  }

  const response = await downloadTerrainTile(tileUrl);
  const bytes = Buffer.from(await response.arrayBuffer());
  const imagerySources = response.headers.get('x-amz-meta-x-imagery-sources') ?? '';

  if (tilePath !== undefined) {
    try {
      await mkdir(dirname(tilePath), { recursive: true });
      await writeAtomically(`${tilePath}.sources`, imagerySources);
      await writeAtomically(tilePath, bytes);
    } catch (error) {
      // A failed write only costs a re-download next time; the tile itself is fine.
      console.warn(
        JSON.stringify({ event: 'terrain_tile_cache_failed', tileUrl, error: String(error) }),
      );
    }
  }

  return { bytes, imagerySources };
}

/** Renames into place so concurrent runs never read a half-written tile. */
async function writeAtomically(path: string, contents: string | Buffer): Promise<void> {
  const temporaryPath = `${path}.${process.pid.toString()}.${Math.random().toString(36).slice(2)}.tmp`;

  await writeFile(temporaryPath, contents);
  await rename(temporaryPath, path);
}
