import { downloadTerrainTile } from './terrain-tile-download';
import { loadRealTerrain as loadTerrainFromTiles } from './real-terrain';
import type { DecodedTerrainTile, RealTerrain } from './real-terrain';

const terrainTileSizePixels = 256;

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
  const response = await downloadTerrainTile(tileUrl);

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
