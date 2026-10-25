import { realTerrainBounds } from './constants/real-terrain';

export interface RealTerrain {
  sample: (x: number, y: number, width: number, height: number) => number;
  attribution: string;
}

/** Raw decoded RGBA pixels and source metadata for one 256px Terrarium tile. */
export interface DecodedTerrainTile {
  pixels: Uint8Array;
  imagerySources: string;
}

/** Keeps fetching and image decoding platform-specific while sharing terrain sampling. */
export type TerrainTileLoader = (tileUrl: string) => Promise<DecodedTerrainTile>;

const earthCircumferenceMeters = 40075016.686;
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
    throw new Error(
      'Use latitude −85 to 85, longitude −180 to 180, and an area width of 2–200 km.',
    );
  }

  const latitudeRadians = (latitude * Math.PI) / 180;
  const spanFraction = (spanKm * 1000) / (earthCircumferenceMeters * Math.cos(latitudeRadians));
  const zoom = Math.max(0, Math.min(14, Math.floor(Math.log2(2 / spanFraction))));
  const tileCount = 2 ** zoom;
  const centerX = ((longitude + 180) / 360) * tileCount;
  const centerY = ((1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2) * tileCount;
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

  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      requests.push(loadTerrainTile(x, y));
    }
  }

  await Promise.all(requests);
  let minimum = Infinity;
  let maximum = -Infinity;

  for (const elevation of elevations) {
    minimum = Math.min(minimum, elevation);
    maximum = Math.max(maximum, elevation);
  }

  const elevationRange = Math.max(1, maximum - minimum);

  return {
    attribution: [...credits].join(' · '),
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
        elevations[top * columns + left] * (1 - fractionX) +
        elevations[top * columns + right] * fractionX;
      const lower =
        elevations[bottom * columns + left] * (1 - fractionX) +
        elevations[bottom * columns + right] * fractionX;

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
