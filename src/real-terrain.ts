import type { RealContourInterval } from './real-terrain-contours';
import { realTerrainBounds } from './constants/real-terrain';
import { getMercatorSpanFraction, getMercatorX, getMercatorY } from './real-terrain-projection';
import { preprocessElevations } from './elevation-preprocessing';
import { TerrainLoadError } from './terrain-load-error';
import type { GeoCoverage, GeoPoint, SourceElevationSampler } from './types/terrain-analysis';

export interface RealTerrain {
  sample: (x: number, y: number, width: number, height: number) => number;
  attribution: string;
  spanKm?: number;
  location?: { latitude: number; longitude: number };
  seaLevel?: number;
  seaLevelHatching?: boolean;
  contourInterval?: RealContourInterval;
  elevations?: {
    minimumMeters: number;
    maximumMeters: number;
    originMeters: number;
    metersPerUnit: number;
  };
  /** Repaired source metres by place, before the depth floor and every display transform. */
  sourceElevations?: SourceElevationSampler;
}

/** Raw decoded RGBA pixels and source metadata for one 256px Terrarium tile. */
export interface DecodedTerrainTile {
  pixels: Uint8Array;
  imagerySources: string;
}

/** Keeps fetching and image decoding platform-specific while sharing terrain sampling. */
/** Called with 0 of N before the first tile, then once per tile that finishes. */
export type TerrainLoadProgressReporter = (loadedTiles: number, totalTiles: number) => void;

export type TerrainTileLoader = (tileUrl: string) => Promise<DecodedTerrainTile>;

const tileSizePixels = 256;

/** Decodes the public Terrarium RGB elevation format into meters. */
export function decodeTerrariumElevation(red: number, green: number, blue: number): number {
  return red * 256 + green + blue / 256 - 32768;
}

/** Downloads a bounded patch of terrain without credentials or a server. */
export async function loadRealTerrain(
  latitude: number,
  longitude: number,
  spanKm: number,
  loadTile: TerrainTileLoader,
  elevationFloor?: number,
  maxDepth?: number,
  onProgress?: TerrainLoadProgressReporter,
): Promise<RealTerrain> {
  if (
    !Number.isFinite(latitude) ||
    latitude < realTerrainBounds.minimumLatitude ||
    latitude > realTerrainBounds.maximumLatitude ||
    !Number.isFinite(longitude) ||
    longitude < realTerrainBounds.minimumLongitude ||
    longitude > realTerrainBounds.maximumLongitude ||
    !Number.isFinite(spanKm) ||
    spanKm < realTerrainBounds.minimumSpanKm ||
    spanKm > realTerrainBounds.maximumSpanKm
  ) {
    throw new TerrainLoadError(
      'locationOutOfRange',
      'Use latitude −85 to 85, longitude −180 to 180, and an area width of 2–200 km.',
    );
  }

  if (
    elevationFloor !== undefined &&
    (!Number.isFinite(elevationFloor) || elevationFloor < -11000 || elevationFloor > 8900)
  ) {
    throw new TerrainLoadError(
      'locationOutOfRange',
      'Elevation floor must be between −11000 and 8900 meters.',
    );
  }

  if (maxDepth !== undefined && (!Number.isFinite(maxDepth) || maxDepth < 0 || maxDepth > 11000)) {
    throw new TerrainLoadError(
      'locationOutOfRange',
      'Maximum depth must be between 0 and 11000 meters.',
    );
  }

  const effectiveFloor =
    maxDepth === undefined ? elevationFloor : Math.max(elevationFloor ?? -Infinity, -maxDepth);

  // Shared with feature projection, so overlays land where terrain is sampled.
  const spanFraction = getMercatorSpanFraction(latitude, spanKm);
  const zoom = Math.max(0, Math.min(14, Math.floor(Math.log2(2 / spanFraction))));
  const tileCount = 2 ** zoom;
  const centerX = getMercatorX(longitude) * tileCount;
  const centerY = getMercatorY(latitude) * tileCount;
  const spanTiles = spanFraction * tileCount;
  const startX = Math.floor(centerX - spanTiles / 2);
  const startY = Math.floor(centerY - spanTiles / 2);
  const endX = Math.floor(centerX + spanTiles / 2);
  const endY = Math.floor(centerY + spanTiles / 2);
  const columns = (endX - startX + 1) * tileSizePixels;
  const rows = (endY - startY + 1) * tileSizePixels;
  const elevations = new Float64Array(columns * rows);
  const requests: Promise<void>[] = [];
  const credits = new Set<string>();
  let loadedTileCount = 0;

  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      requests.push(loadTerrainTile(x, y));
    }
  }

  onProgress?.(0, requests.length);
  await Promise.all(requests);

  elevations.set(preprocessElevations(elevations, columns, rows).values);

  // Opt-in clipping avoids inventing coastline geometry or changing legacy terrain. It applies on
  // read so the grid keeps the source metres terrain analysis measures.
  const floorMeters = effectiveFloor ?? -Infinity;
  const readClipped = (index: number): number => Math.max(floorMeters, elevations[index]);
  let minimum = Infinity;
  let maximum = -Infinity;

  for (let index = 0; index < elevations.length; index++) {
    minimum = Math.min(minimum, readClipped(index));
    maximum = Math.max(maximum, readClipped(index));
  }

  const elevationRange = Math.max(1, maximum - minimum);
  let visibleMinimum = Infinity;
  let visibleMaximum = -Infinity;
  const left = Math.max(0, Math.floor((centerX - startX - spanTiles / 2) * tileSizePixels));
  const right = Math.min(
    columns - 1,
    Math.ceil((centerX - startX + spanTiles / 2) * tileSizePixels),
  );
  const top = Math.max(0, Math.floor((centerY - startY - spanTiles / 2) * tileSizePixels));
  const bottom = Math.min(rows - 1, Math.ceil((centerY - startY + spanTiles / 2) * tileSizePixels));

  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      visibleMinimum = Math.min(visibleMinimum, readClipped(y * columns + x));
      visibleMaximum = Math.max(visibleMaximum, readClipped(y * columns + x));
    }
  }

  return {
    location: { latitude, longitude },
    spanKm,
    elevations: {
      minimumMeters: visibleMinimum,
      maximumMeters: visibleMaximum,
      originMeters: minimum + elevationRange / 2,
      metersPerUnit: elevationRange / 1.6,
    },
    attribution: [...credits].join(' · '),
    seaLevel: ((0 - minimum) / elevationRange - 0.5) * 1.6,
    sample(x, y, width, height) {
      const frameSize = Math.max(width, height);
      const pixelX = Math.max(
        0,
        Math.min(
          columns - 1,
          (centerX - startX + ((x - width / 2) / frameSize) * spanTiles) * tileSizePixels,
        ),
      );
      const pixelY = Math.max(
        0,
        Math.min(
          rows - 1,
          (centerY - startY + ((y - height / 2) / frameSize) * spanTiles) * tileSizePixels,
        ),
      );
      const left = Math.floor(pixelX);
      const top = Math.floor(pixelY);
      const right = Math.min(columns - 1, left + 1);
      const bottom = Math.min(rows - 1, top + 1);
      const fractionX = pixelX - left;
      const fractionY = pixelY - top;
      const upper =
        readClipped(top * columns + left) * (1 - fractionX) +
        readClipped(top * columns + right) * fractionX;
      const lower =
        readClipped(bottom * columns + left) * (1 - fractionX) +
        readClipped(bottom * columns + right) * fractionX;

      return ((upper * (1 - fractionY) + lower * fractionY - minimum) / elevationRange - 0.5) * 1.6;
    },
    sourceElevations: createSourceElevationSampler(
      { values: elevations, columns, rows, startX, startY, tileCount, centerLongitude: longitude },
      // Neighbouring samples sit one pixel apart; the span covers spanTiles tiles of pixels.
      (spanKm * 1000) / (spanTiles * tileSizePixels),
      `real:${[latitude, longitude, spanKm, elevationFloor ?? 'none', maxDepth ?? 'none'].join(',')}`,
    ),
  };

  /** Copies one decoded tile into the shared elevation grid. */
  async function loadTerrainTile(x: number, y: number): Promise<void> {
    const wrappedX = ((x % tileCount) + tileCount) % tileCount;
    const boundedY = Math.max(0, Math.min(tileCount - 1, y));
    const tile = await loadTile(
      `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${wrappedX}/${boundedY}.png`,
    );
    const sources = tile.imagerySources.toLowerCase();

    for (const [identifiers, credit] of terrainCredits) {
      if (identifiers.some((identifier) => sources.includes(identifier)) || sources === '') {
        credits.add(credit);
      }
    }

    if (tile.pixels.length !== tileSizePixels * tileSizePixels * 4) {
      throw new TerrainLoadError('tileDecodeFailed', 'Terrain tile has unexpected dimensions.');
    }

    for (let row = 0; row < tileSizePixels; row++) {
      for (let column = 0; column < tileSizePixels; column++) {
        const offset = (row * tileSizePixels + column) * 4;

        elevations[
          ((y - startY) * tileSizePixels + row) * columns + (x - startX) * tileSizePixels + column
        ] = decodeTerrariumElevation(
          tile.pixels[offset],
          tile.pixels[offset + 1],
          tile.pixels[offset + 2],
        );
      }
    }

    onProgress?.(++loadedTileCount, requests.length);
  }
}

const terrainCredits: readonly [readonly string[], string][] = [
  [
    ['eudem'],
    'Produced using Copernicus data and information funded by the European Union — EU-DEM layers',
  ],
  [
    ['ned', '3dep', 'srtm', 'gmted'],
    '3DEP, SRTM and GMTED2010 terrain data courtesy of the U.S. Geological Survey',
  ],
  [['etopo'], 'ETOPO1: DOC/NOAA/NESDIS/NCEI, U.S. Department of Commerce'],
  [['aster', 'arctic'], 'ArcticDEM: DigitalGlobe imagery; NSF awards 1043681, 1559691 and 1542736'],
  [['australia'], '© Commonwealth of Australia (Geoscience Australia) 2017'],
  [['austria'], '© offene Daten Österreichs — Digitales Geländemodell (DGM) Österreich'],
  [['canada', 'cdem'], 'Contains information licensed under the Open Government Licence — Canada'],
  [['mexico', 'inegi'], 'Source: INEGI, Continental relief, 2016'],
  [
    ['newzealand', 'nz', 'linz'],
    'Copyright 2011 Crown copyright (c) Land Information New Zealand and the New Zealand Government. All rights reserved',
  ],
  [['norway'], '© Kartverket'],
  [
    ['uk', 'greatbritain'],
    '© Environment Agency copyright and/or database right 2015. All rights reserved',
  ],
];

/** Where the loaded grid sits: sample (column, row) lies at tile (startX + column / 256, startY + row / 256). */
interface PlacedElevationGrid {
  values: Float64Array;
  columns: number;
  rows: number;
  startX: number;
  startY: number;
  tileCount: number;
  centerLongitude: number;
}

/** Reads repaired metres by place with the same grid placement `sample` uses for frame points. */
function createSourceElevationSampler(
  grid: PlacedElevationGrid,
  resolutionMeters: number,
  revision: string,
): SourceElevationSampler {
  const { values, columns, rows, startX, startY, tileCount, centerLongitude } = grid;
  const worldPixels = tileCount * tileSizePixels;
  // Rows beyond the Mercator world repeat clamped polar tiles, so they hold nobody's elevation.
  const firstRow = Math.max(0, -startY * tileSizePixels);
  const lastRow = Math.min(rows - 1, (tileCount - startY) * tileSizePixels - 1);
  const centerWorldX = getMercatorX(centerLongitude);
  // Like getRealTerrainSourceBounds, west or east runs past ±180° near the antimeridian.
  const coverage: GeoCoverage = {
    north: getLatitudeAtMercatorY((startY * tileSizePixels + firstRow) / worldPixels),
    south: getLatitudeAtMercatorY((startY * tileSizePixels + lastRow) / worldPixels),
    west: getLongitudeAtMercatorX(startX / tileCount),
    east: getLongitudeAtMercatorX((startX * tileSizePixels + columns - 1) / worldPixels),
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
      const column = worldX * worldPixels - startX * tileSizePixels;
      const row = getMercatorY(latitude) * worldPixels - startY * tileSizePixels;

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

function getLatitudeAtMercatorY(mercatorY: number): number {
  return (Math.atan(Math.sinh(Math.PI * (1 - 2 * mercatorY))) * 180) / Math.PI;
}

function getLongitudeAtMercatorX(mercatorX: number): number {
  return mercatorX * 360 - 180;
}
