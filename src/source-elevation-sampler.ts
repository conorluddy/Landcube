/**
 * Source elevations in metres by place (REQ-5, REQ-7): bilinear reads of the repaired, unclipped
 * Terrarium grid, located with the same Mercator placement `RealTerrain.sample` uses.
 */
import { terrariumTileSizePixels } from './constants/real-terrain';
import {
  getLatitudeAtMercatorY,
  getLongitudeAtMercatorX,
  getMercatorX,
  getMercatorY,
} from './real-terrain-projection';
import type { GeoCoverage, GeoPoint, SourceElevationSampler } from './types/terrain-analysis';

/** Where the loaded grid sits: sample (column, row) lies at tile (startX + column / 256, startY + row / 256). */
export interface PlacedElevationGrid {
  values: Float64Array;
  columns: number;
  rows: number;
  startX: number;
  startY: number;
  tileCount: number;
  centerLongitude: number;
}

/** Reads repaired metres by place with the same grid placement `sample` uses for frame points. */
export function createSourceElevationSampler(
  grid: PlacedElevationGrid,
  resolutionMeters: number,
  revision: string,
): SourceElevationSampler {
  const { values, columns, rows, startX, startY, tileCount, centerLongitude } = grid;
  const worldPixels = tileCount * terrariumTileSizePixels;
  // Rows beyond the Mercator world repeat clamped polar tiles, so they hold nobody's elevation.
  const firstRow = Math.max(0, -startY * terrariumTileSizePixels);
  const lastRow = Math.min(rows - 1, (tileCount - startY) * terrariumTileSizePixels - 1);
  const centerWorldX = getMercatorX(centerLongitude);
  // Like getRealTerrainSourceBounds, west or east runs past ±180° near the antimeridian.
  const coverage: GeoCoverage = {
    north: getLatitudeAtMercatorY((startY * terrariumTileSizePixels + firstRow) / worldPixels),
    south: getLatitudeAtMercatorY((startY * terrariumTileSizePixels + lastRow) / worldPixels),
    west: getLongitudeAtMercatorX(startX / tileCount),
    east: getLongitudeAtMercatorX((startX * terrariumTileSizePixels + columns - 1) / worldPixels),
  };

  return {
    revision,
    resolutionMeters,
    coverage,
    sampleMeters({ latitude, longitude }: GeoPoint) {
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90) {
        return undefined;
      }

      // Wrapping toward the centre keeps a patch that straddles the antimeridian contiguous.
      const eastOffset = getMercatorX(longitude) - centerWorldX;
      const worldX = centerWorldX + eastOffset - Math.round(eastOffset);
      const column = worldX * worldPixels - startX * terrariumTileSizePixels;
      const row = getMercatorY(latitude) * worldPixels - startY * terrariumTileSizePixels;

      if (!(column >= 0 && column <= columns - 1 && row >= firstRow && row <= lastRow)) {
        return undefined;
      }

      const left = Math.floor(column);
      const top = Math.floor(row);
      const right = Math.min(columns - 1, left + 1);
      const bottom = Math.min(lastRow, top + 1);
      const fractionX = column - left;
      const fractionY = row - top;
      const upper =
        values[top * columns + left] * (1 - fractionX) + values[top * columns + right] * fractionX;
      const lower =
        values[bottom * columns + left] * (1 - fractionX) +
        values[bottom * columns + right] * fractionX;
      const meters = upper * (1 - fractionY) + lower * fractionY;

      return Number.isFinite(meters) ? meters : undefined;
    },
  };
}
