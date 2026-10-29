import type { RealContourInterval } from './real-terrain-contours';
import { realTerrainBounds, realTerrainBoundsMessage } from './constants/real-terrain';
import {
  getTerrainDetailProfile,
  maximumConcurrentTileRequests,
  maximumTerrainTileZoom,
  type TerrainDetailProfile,
} from './constants/terrain-detail';
import { versionOneDesignDefaults } from './constants/design';
import { engineConfiguration } from './constants/engine';
import { getMercatorSpanFraction, getMercatorX, getMercatorY } from './real-terrain-projection';
import { preprocessElevations } from './elevation-preprocessing';
import { getSampleGrid } from './terrain-generation';
import type { TerrainConfiguration, TerrainDetail } from './types/terrain';

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
  /** Set above standard detail; standard terrain omits it and samples as version one did. */
  detail?: Exclude<TerrainDetail, 'standard'>;
  /** Sampling density matched to the loaded tiles, replacing the engine defaults. */
  sampling?: Pick<TerrainConfiguration, 'sampleSpacing' | 'maxSamples'>;
}

/** Raw decoded RGBA pixels and source metadata for one 256px Terrarium tile. */
export interface DecodedTerrainTile {
  pixels: Uint8Array;
  imagerySources: string;
}

/** Keeps fetching and image decoding platform-specific while sharing terrain sampling. */
export type TerrainTileLoader = (tileUrl: string) => Promise<DecodedTerrainTile>;

/** Chooses how much source data a load fetches; omitted options keep version-one terrain. */
export interface RealTerrainDetailOptions {
  detail?: TerrainDetail;
  /** Output frame the terrain is prepared for; detail never depends on the viewport. */
  frame?: { width: number; height: number };
  /** Maximum tiles per load; the zoom steps down until the area fits. */
  tileBudget?: number;
}

const tileSizePixels = 256;
const legacyMaximumZoom = 14;

/** Decodes the public Terrarium RGB elevation format into meters. */
export function decodeTerrariumElevation(red: number, green: number, blue: number): number {
  return red * 256 + green + blue / 256 - 32768;
}

/**
 * Tile zoom for a load. Standard keeps the version-one rule: the span covers one to two tiles.
 * Higher detail picks the shallowest zoom giving each output sample enough source pixels,
 * capped at the deepest Terrarium zoom and stepped down to fit the tile budget.
 */
export function selectTerrainZoom(
  latitude: number,
  longitude: number,
  spanKm: number,
  options: RealTerrainDetailOptions = {},
): number {
  const spanFraction = getMercatorSpanFraction(latitude, spanKm);
  const legacyZoom = Math.max(
    0,
    Math.min(legacyMaximumZoom, Math.floor(Math.log2(2 / spanFraction))),
  );
  const profile = getTerrainDetailProfile(options.detail);

  if (!profile) {
    return legacyZoom;
  }

  const targetPixels = getSamplesAcross(profile, options.frame) * profile.sourcePixelsPerSample;
  let zoom = Math.max(
    legacyZoom,
    Math.min(
      maximumTerrainTileZoom,
      Math.ceil(Math.log2(targetPixels / (tileSizePixels * spanFraction))),
    ),
  );
  const tileBudget = options.tileBudget ?? profile.tileBudget.node;

  while (
    zoom > legacyZoom &&
    countTiles(getTileRange(latitude, longitude, spanFraction, zoom)) > tileBudget
  ) {
    zoom--;
  }

  return zoom;
}

/** Downloads a bounded patch of terrain without credentials or a server. */
export async function loadRealTerrain(
  latitude: number,
  longitude: number,
  spanKm: number,
  loadTile: TerrainTileLoader,
  elevationFloor?: number,
  maxDepth?: number,
  options: RealTerrainDetailOptions = {},
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
    throw new Error(realTerrainBoundsMessage);
  }

  if (
    elevationFloor !== undefined &&
    (!Number.isFinite(elevationFloor) || elevationFloor < -11000 || elevationFloor > 8900)
  ) {
    throw new Error('Elevation floor must be between −11000 and 8900 meters.');
  }

  if (maxDepth !== undefined && (!Number.isFinite(maxDepth) || maxDepth < 0 || maxDepth > 11000)) {
    throw new Error('Maximum depth must be between 0 and 11000 meters.');
  }

  const effectiveFloor =
    maxDepth === undefined ? elevationFloor : Math.max(elevationFloor ?? -Infinity, -maxDepth);
  const profile = getTerrainDetailProfile(options.detail);

  // Shared with feature projection, so overlays land where terrain is sampled.
  const spanFraction = getMercatorSpanFraction(latitude, spanKm);
  const zoom = selectTerrainZoom(latitude, longitude, spanKm, options);
  const tileCount = 2 ** zoom;
  const { centerX, centerY, spanTiles, startX, startY, endX, endY } = getTileRange(
    latitude,
    longitude,
    spanFraction,
    zoom,
  );
  const columns = (endX - startX + 1) * tileSizePixels;
  const rows = (endY - startY + 1) * tileSizePixels;
  const elevations = new Float64Array(columns * rows);
  const credits = new Set<string>();
  const tiles: { x: number; y: number }[] = [];

  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      tiles.push({ x, y });
    }
  }

  // A small pool keeps requests polite; each tile fills its own region, so order never matters.
  let nextTile = 0;

  await Promise.all(
    Array.from({ length: Math.min(maximumConcurrentTileRequests, tiles.length) }, async () => {
      while (nextTile < tiles.length) {
        const { x, y } = tiles[nextTile++];

        await loadTerrainTile(x, y);
      }
    }),
  );

  elevations.set(preprocessElevations(elevations, columns, rows).values);

  // Opt-in clipping avoids inventing coastline geometry or changing legacy terrain.
  if (effectiveFloor !== undefined) {
    for (let index = 0; index < elevations.length; index++) {
      elevations[index] = Math.max(effectiveFloor, elevations[index]);
    }
  }

  // Averaging surplus source pixels keeps fine data from aliasing between samples.
  const filterFactor = profile
    ? Math.max(
        1,
        Math.floor((spanTiles * tileSizePixels) / getSamplesAcross(profile, options.frame)),
      )
    : 1;
  const grid =
    filterFactor > 1
      ? boxFilterElevations(elevations, columns, rows, filterFactor)
      : { values: elevations, columns, rows };
  // Grid cell centres sit at the middle of each averaged block of source pixels.
  const toGrid = (sourcePixel: number) => (sourcePixel - (filterFactor - 1) / 2) / filterFactor;
  let minimum = Infinity;
  let maximum = -Infinity;

  for (const elevation of grid.values) {
    minimum = Math.min(minimum, elevation);
    maximum = Math.max(maximum, elevation);
  }

  const elevationRange = Math.max(1, maximum - minimum);
  let visibleMinimum = Infinity;
  let visibleMaximum = -Infinity;
  const left = Math.max(0, Math.floor(toGrid((centerX - startX - spanTiles / 2) * tileSizePixels)));
  const right = Math.min(
    grid.columns - 1,
    Math.ceil(toGrid((centerX - startX + spanTiles / 2) * tileSizePixels)),
  );
  const top = Math.max(0, Math.floor(toGrid((centerY - startY - spanTiles / 2) * tileSizePixels)));
  const bottom = Math.min(
    grid.rows - 1,
    Math.ceil(toGrid((centerY - startY + spanTiles / 2) * tileSizePixels)),
  );

  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      visibleMinimum = Math.min(visibleMinimum, grid.values[y * grid.columns + x]);
      visibleMaximum = Math.max(visibleMaximum, grid.values[y * grid.columns + x]);
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
    // Credit order follows the table, not download completion, so output stays reproducible.
    attribution: terrainCredits
      .map(([, credit]) => credit)
      .filter((credit) => credits.has(credit))
      .join(' · '),
    seaLevel: ((0 - minimum) / elevationRange - 0.5) * 1.6,
    ...(profile &&
      options.detail !== undefined &&
      options.detail !== 'standard' && {
        detail: options.detail,
        sampling: profile.sampling,
      }),
    sample(x, y, width, height) {
      const frameSize = Math.max(width, height);
      const pixelX = Math.max(
        0,
        Math.min(
          grid.columns - 1,
          toGrid((centerX - startX + ((x - width / 2) / frameSize) * spanTiles) * tileSizePixels),
        ),
      );
      const pixelY = Math.max(
        0,
        Math.min(
          grid.rows - 1,
          toGrid((centerY - startY + ((y - height / 2) / frameSize) * spanTiles) * tileSizePixels),
        ),
      );
      const left = Math.floor(pixelX);
      const top = Math.floor(pixelY);
      const right = Math.min(grid.columns - 1, left + 1);
      const bottom = Math.min(grid.rows - 1, top + 1);
      const fractionX = pixelX - left;
      const fractionY = pixelY - top;
      const values = grid.values;
      const upper =
        values[top * grid.columns + left] * (1 - fractionX) +
        values[top * grid.columns + right] * fractionX;
      const lower =
        values[bottom * grid.columns + left] * (1 - fractionX) +
        values[bottom * grid.columns + right] * fractionX;

      return ((upper * (1 - fractionY) + lower * fractionY - minimum) / elevationRange - 0.5) * 1.6;
    },
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
      throw new Error('Terrain tile has unexpected dimensions.');
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
  }
}

/** Averages `factor`×`factor` blocks; edge blocks average the pixels they have. */
export function boxFilterElevations(
  values: Float64Array,
  columns: number,
  rows: number,
  factor: number,
): { values: Float64Array; columns: number; rows: number } {
  const filteredColumns = Math.ceil(columns / factor);
  const filteredRows = Math.ceil(rows / factor);
  const filtered = new Float64Array(filteredColumns * filteredRows);

  for (let row = 0; row < filteredRows; row++) {
    const rowEnd = Math.min(rows, (row + 1) * factor);

    for (let column = 0; column < filteredColumns; column++) {
      const columnEnd = Math.min(columns, (column + 1) * factor);
      let sum = 0;

      for (let y = row * factor; y < rowEnd; y++) {
        for (let x = column * factor; x < columnEnd; x++) {
          sum += values[y * columns + x];
        }
      }

      filtered[row * filteredColumns + column] =
        sum / ((rowEnd - row * factor) * (columnEnd - column * factor));
    }
  }

  return { values: filtered, columns: filteredColumns, rows: filteredRows };
}

// === HELPERS ===

/** Samples across the frame's long edge after `sampleTerrain` applies its budget. */
function getSamplesAcross(
  profile: TerrainDetailProfile,
  frame: { width: number; height: number } = versionOneDesignDefaults,
): number {
  const { spacing } = getSampleGrid(frame.width, frame.height, {
    ...profile.sampling,
    overscan: engineConfiguration.overscan,
  });

  return Math.max(frame.width, frame.height) / spacing;
}

/** Tiles covering a square span centred on the location, in tile coordinates at `zoom`. */
function getTileRange(latitude: number, longitude: number, spanFraction: number, zoom: number) {
  const tileCount = 2 ** zoom;
  const centerX = getMercatorX(longitude) * tileCount;
  const centerY = getMercatorY(latitude) * tileCount;
  const spanTiles = spanFraction * tileCount;

  return {
    centerX,
    centerY,
    spanTiles,
    startX: Math.floor(centerX - spanTiles / 2),
    startY: Math.floor(centerY - spanTiles / 2),
    endX: Math.floor(centerX + spanTiles / 2),
    endY: Math.floor(centerY + spanTiles / 2),
  };
}

function countTiles(range: ReturnType<typeof getTileRange>): number {
  return (range.endX - range.startX + 1) * (range.endY - range.startY + 1);
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
