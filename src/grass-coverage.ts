import { getRoadHalfWidth } from './road-ribbons';
import { sampleHeightField } from './terrain-surface';
import { roadDetailClasses } from './constants/roads';
import type { TerrainCropShape } from './terrain-crop';
import type { HeightField } from './types/terrain';
import type { GrassStyle } from './types/grass';
import type { RoadPath, RoadStyle } from './types/roads';

/** Where grass may grow: the model crop plus the geography that rules places out. */
export interface GrassSite {
  field: HeightField;
  width: number;
  height: number;
  shape: TerrainCropShape;
  /** The crop's offset in the source frame; patches are anchored there so crops never reshape them. */
  originX: number;
  originY: number;
  frameUnitsPerMm: number;
  /** Real-world scale, so slope limits use true slopes rather than exaggerated ones. */
  metersPerFieldUnit: number;
  metersPerFrameUnit: number;
  /** Field elevation at or below which ground counts as sea. */
  seaLevel?: number;
  /** Road centrelines in crop units with their half-widths; grass never grows on them. */
  roads: readonly { points: readonly { x: number; y: number }[]; halfWidth: number }[];
}

/** Drawn roads as grass clearances, matching the ribbons' classes and widths; none when roads are off. */
export function getGrassRoads(
  paths: readonly RoadPath[],
  style: Pick<RoadStyle, 'enabled' | 'detail' | 'widthMm'>,
  frameUnitsPerMm: number,
): GrassSite['roads'] {
  if (!style.enabled) {
    return [];
  }

  const classes: readonly string[] = roadDetailClasses[style.detail];

  return paths
    .filter((path) => classes.includes(path.roadClass))
    .map((path) => ({
      points: path.points,
      halfWidth: getRoadHalfWidth(path.roadClass, style.widthMm, frameUnitsPerMm),
    }));
}

/** The real-world scale and source anchoring the studio knows and the renderer does not. */
export type GrassGeography = Pick<
  GrassSite,
  'originX' | 'originY' | 'metersPerFieldUnit' | 'metersPerFrameUnit'
>;

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
  /** Source-frame centre of each texel, where patch noise is anchored. */
  sourceX: Float32Array;
  sourceY: Float32Array;
  /** Dry patch noise, 0 to 255. */
  dryness: Uint8Array;
}

/** Texels along the crop's longer side: about 0.3 mm on a 150 mm model, finer than any road. */
export const grassCoverageResolution = 512;

const grassSeed = 0x6a55;
// Patch noise is the slowest part of a style rebuild and depends only on clumping.
const patchNoiseCache = new WeakMap<GrassGround, { clumping: number; values: Float32Array }>();

/** Measures the crop once per terrain, crop or road change. */
export function surveyGrassGround(
  site: GrassSite,
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
    sourceX: new Float32Array(count),
    sourceY: new Float32Array(count),
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
      const sourceX = x + site.originX;
      const sourceY = y + site.originY;

      ground.sourceX[index] = sourceX;
      ground.sourceY[index] = sourceY;
      ground.dryness[index] = Math.round(fractalNoise(sourceX * 0.012, sourceY * 0.012, 23) * 255);

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

function isInsideFootprint(x: number, y: number, site: GrassSite): boolean {
  if (site.shape === 'circle') {
    const radius = site.width / 2;

    return Math.hypot(x - radius, y - radius) <= radius;
  }

  return x >= 0 && x <= site.width && y >= 0 && y <= site.height;
}

/** The real, unexaggerated slope from neighbouring texels, so exaggeration never moves grass. */
function getSlopeDegrees(
  site: GrassSite,
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
  const cached = patchNoiseCache.get(ground);

  if (cached?.clumping === clumping) {
    return cached.values;
  }

  const scale = 0.004 + (1 - clumping) * 0.01;
  const values = new Float32Array(ground.sourceX.length);

  for (let index = 0; index < values.length; index++) {
    values[index] = fractalNoise(ground.sourceX[index] * scale, ground.sourceY[index] * scale, 11);
  }

  patchNoiseCache.set(ground, { clumping, values });

  return values;
}

function getFieldRange(field: HeightField): [number, number] {
  let minimum = Infinity;
  let maximum = -Infinity;

  for (const value of field.values) {
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }

  return [minimum, maximum];
}

/** Buckets road segments so each texel checks only the roads near it. */
function createRoadIndex(roads: GrassSite['roads']): { covers: (x: number, y: number) => boolean } {
  const bucketUnits = 16;
  const buckets = new Map<
    number,
    { startX: number; startY: number; endX: number; endY: number; reachUnits: number }[]
  >();

  for (const road of roads) {
    // A little clearance either side keeps blades off the asphalt edge.
    const reach = road.halfWidth * 1.4;

    for (let index = 1; index < road.points.length; index++) {
      const a = road.points[index - 1];
      const b = road.points[index];
      const segment = { startX: a.x, startY: a.y, endX: b.x, endY: b.y, reachUnits: reach };

      for (
        let gx = Math.floor((Math.min(a.x, b.x) - reach) / bucketUnits);
        gx <= Math.floor((Math.max(a.x, b.x) + reach) / bucketUnits);
        gx++
      ) {
        for (
          let gy = Math.floor((Math.min(a.y, b.y) - reach) / bucketUnits);
          gy <= Math.floor((Math.max(a.y, b.y) + reach) / bucketUnits);
          gy++
        ) {
          const key = getBucketKey(gx, gy);
          const bucket = buckets.get(key);

          if (bucket) {
            bucket.push(segment);
          } else {
            buckets.set(key, [segment]);
          }
        }
      }
    }
  }

  return {
    covers(x, y) {
      if (buckets.size === 0) {
        return false;
      }

      const bucket = buckets.get(
        getBucketKey(Math.floor(x / bucketUnits), Math.floor(y / bucketUnits)),
      );

      return (
        bucket?.some((segment) => distanceToSegment(x, y, segment) < segment.reachUnits) ?? false
      );
    },
  };
}

/** Numeric keys avoid building a string per texel; crops stay far inside ±2^20 buckets. */
function getBucketKey(column: number, row: number): number {
  return (column + 2 ** 20) * 2 ** 21 + (row + 2 ** 20);
}

function distanceToSegment(
  x: number,
  y: number,
  segment: { startX: number; startY: number; endX: number; endY: number },
): number {
  const deltaX = segment.endX - segment.startX;
  const deltaY = segment.endY - segment.startY;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  const along =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((x - segment.startX) * deltaX + (y - segment.startY) * deltaY) / lengthSquared,
          ),
        );

  return Math.hypot(x - (segment.startX + deltaX * along), y - (segment.startY + deltaY * along));
}

/** Integer hash of a cell and salt to [0, 1); stable across platforms and sessions. */
function hashCell(column: number, row: number, salt: number): number {
  let hash =
    Math.imul(column, 0x27d4eb2d) ^
    Math.imul(row, 0x165667b1) ^
    Math.imul(salt + grassSeed, 0x9e3779b1);

  hash = Math.imul(hash ^ (hash >>> 15), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  hash ^= hash >>> 16;

  return (hash >>> 0) / 4294967296;
}

/** Two-octave value noise in [0, 1], seeded by `salt`. */
function fractalNoise(x: number, y: number, salt: number): number {
  return valueNoise(x, y, salt) * 0.65 + valueNoise(x * 2.3 + 17, y * 2.3 + 5, salt + 1) * 0.35;
}

function valueNoise(x: number, y: number, salt: number): number {
  const column = Math.floor(x);
  const row = Math.floor(y);
  const fx = x - column;
  const fy = y - row;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = hashCell(column, row, salt) * (1 - sx) + hashCell(column + 1, row, salt) * sx;
  const bottom =
    hashCell(column, row + 1, salt) * (1 - sx) + hashCell(column + 1, row + 1, salt) * sx;

  return top * (1 - sy) + bottom * sy;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - edge0) / Math.max(1e-9, edge1 - edge0)));

  return t * t * (3 - 2 * t);
}
