import {
  createRoadIndex,
  fractalNoise,
  getFieldRange,
  isInsideFootprint,
  smoothstep,
  type DecorationSite,
} from './decoration-field';
import { sampleHeightField } from './terrain-surface';
import type { GrassStyle } from './types/grass';

/** A growth texture over the model crop, sampled by the grass shader. */
export interface GrassCoverageMap {
  columns: number;
  rows: number;
  /**
   * RGBA per texel: R is how strongly grass grows (0 bare to 255 full length), G is smooth patch
   * noise the shader turns into dry grass. Row 0 is the crop's top (y = 0) edge.
   */
  data: Uint8Array;
}

type GrassCoverageStyle = Pick<
  GrassStyle,
  'coverage' | 'clumping' | 'slopeLimitDegrees' | 'altitudeLimit'
>;

/**
 * Per-texel facts that change only with the terrain, crop or roads, so style sliders reuse them
 * and only redo cheap thresholds.
 */
export interface GrassGround {
  columns: number;
  rows: number;
  /** Real slope in degrees; NaN where grass can never grow (outside the crop, roads, sea). */
  slope: Float32Array;
  /** Elevation as a share of the field's relief, 0 to 1. */
  altitude: Float32Array;
  /**
   * Each texel's source-frame centre in printed millimetres, where patch noise is anchored. The
   * frame follows the window size at 3D start, so millimetres keep patches the same size anyway.
   */
  sourceXMm: Float32Array;
  sourceYMm: Float32Array;
  /** Dry patch noise, 0 to 255. */
  dryness: Uint8Array;
  /** Patch noise is the slowest part of a style rebuild and depends only on clumping. */
  patchNoise?: { clumping: number; values: Float32Array };
}

/** Texels along the crop's longer side: about 0.3 mm on a 150 mm model, finer than any road. */
export const grassCoverageResolution = 512;

/** Noise frequencies per printed millimetre: dry patches ~17 mm, grass patches 14–50 mm. */
const dryPatchesPerMm = 0.06;
const sparsePatchesPerMm = 0.07;
const clumpedPatchesPerMm = 0.02;

/** Measures the crop once per terrain, crop or road change. */
export function surveyGrassGround(
  site: DecorationSite,
  resolution = grassCoverageResolution,
): GrassGround {
  const texelUnits = Math.max(site.width, site.height) / resolution;
  const columns = Math.max(1, Math.round(site.width / texelUnits));
  const rows = Math.max(1, Math.round(site.height / texelUnits));
  const count = columns * rows;
  const ground: GrassGround = {
    columns,
    rows,
    slope: new Float32Array(count).fill(Number.NaN),
    altitude: new Float32Array(count),
    sourceXMm: new Float32Array(count),
    sourceYMm: new Float32Array(count),
    dryness: new Uint8Array(count),
  };
  const [minimum, maximum] = getFieldRange(site.field);
  const roads = createRoadIndex(site.roads);
  const columnUnits = site.width / columns;
  const rowUnits = site.height / rows;
  // One height sample per texel; slopes come from neighbouring texels rather than more samples.
  const elevations = new Float32Array(count);

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      elevations[row * columns + column] = sampleHeightField(
        site.field,
        (column + 0.5) * columnUnits,
        (row + 0.5) * rowUnits,
      );
    }
  }

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x = (column + 0.5) * columnUnits;
      const y = (row + 0.5) * rowUnits;
      const index = row * columns + column;
      const sourceXMm = (x + site.originX) / site.frameUnitsPerMm;
      const sourceYMm = (y + site.originY) / site.frameUnitsPerMm;

      ground.sourceXMm[index] = sourceXMm;
      ground.sourceYMm[index] = sourceYMm;
      ground.dryness[index] = Math.round(
        fractalNoise(sourceXMm * dryPatchesPerMm, sourceYMm * dryPatchesPerMm, 23) * 255,
      );

      const elevation = elevations[index];

      if (
        !isInsideFootprint(x, y, site) ||
        (site.seaLevel !== undefined && elevation <= site.seaLevel) ||
        roads.covers(x, y)
      ) {
        continue;
      }

      ground.slope[index] = getSlopeDegrees(site, elevations, columns, rows, column, row);
      ground.altitude[index] = (elevation - minimum) / Math.max(1e-9, maximum - minimum);
    }
  }

  return ground;
}

/**
 * Where grass grows and how long it gets. Patch noise is sampled in source-frame coordinates, so
 * moving the crop reveals or hides patches without reshaping them, and raising coverage only grows
 * grass where there was none.
 */
export function createGrassCoverage(
  ground: GrassGround,
  style: GrassCoverageStyle,
): GrassCoverageMap {
  const { columns, rows } = ground;
  const data = new Uint8Array(columns * rows * 4);
  const patches = getPatchNoise(ground, style.clumping);
  const patchSoftness = 0.04 + (1 - style.clumping) * 0.3;
  // Noise spans 0..1, so the soft edge sits wholly above it at no coverage and below it at full.
  const patchEdge = 1 + patchSoftness - style.coverage * (1 + 2 * patchSoftness);

  for (let index = 0; index < columns * rows; index++) {
    const offset = index * 4;
    const slope = ground.slope[index];

    data[offset + 1] = ground.dryness[index];
    data[offset + 3] = 255;

    if (Number.isNaN(slope)) {
      continue;
    }

    const growth =
      smoothstep(patchEdge - patchSoftness, patchEdge + patchSoftness, patches[index]) *
      (1 - smoothstep(style.slopeLimitDegrees - 10, style.slopeLimitDegrees, slope)) *
      getAltitudeWeight(ground.altitude[index], style.altitudeLimit);

    data[offset] = Math.round(growth * 255);
  }

  return { columns, rows, data };
}

// === HELPERS ===

/** The real, unexaggerated slope from neighbouring texels, so exaggeration never moves grass. */
function getSlopeDegrees(
  site: DecorationSite,
  elevations: Float32Array,
  columns: number,
  rows: number,
  column: number,
  row: number,
): number {
  const left = Math.max(0, column - 1);
  const right = Math.min(columns - 1, column + 1);
  const top = Math.max(0, row - 1);
  const bottom = Math.min(rows - 1, row + 1);
  const riseX =
    (elevations[row * columns + right] - elevations[row * columns + left]) /
    Math.max(1, right - left) /
    (site.width / columns);
  const riseY =
    (elevations[bottom * columns + column] - elevations[top * columns + column]) /
    Math.max(1, bottom - top) /
    (site.height / rows);
  const gradient = (Math.hypot(riseX, riseY) * site.metersPerFieldUnit) / site.metersPerFrameUnit;

  return (Math.atan(gradient) * 180) / Math.PI;
}

/** Fades out over the tenth of the relief below the limit; 1 keeps grass on the summits. */
function getAltitudeWeight(altitude: number, limit: number): number {
  return limit >= 1 ? 1 : 1 - smoothstep(limit - 0.1, limit, altitude);
}

function getPatchNoise(ground: GrassGround, clumping: number): Float32Array {
  if (ground.patchNoise?.clumping === clumping) {
    return ground.patchNoise.values;
  }

  const scale = clumpedPatchesPerMm + (1 - clumping) * (sparsePatchesPerMm - clumpedPatchesPerMm);
  const values = new Float32Array(ground.sourceXMm.length);

  for (let index = 0; index < values.length; index++) {
    values[index] = fractalNoise(
      ground.sourceXMm[index] * scale,
      ground.sourceYMm[index] * scale,
      11,
    );
  }

  ground.patchNoise = { clumping, values };

  return values;
}
