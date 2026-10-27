import { sampleHeightField } from './terrain-surface';
import type { TerrainCropShape } from './terrain-crop';
import type { HeightField } from './types/terrain';
import type { GrassStyle } from './types/grass';

/** Where grass may grow: the model crop plus the geography that rules places out. */
export interface GrassSite {
  field: HeightField;
  width: number;
  height: number;
  shape: TerrainCropShape;
  /** The crop's offset in the source frame; candidates are anchored there so crops never reshuffle. */
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

/** The real-world scale and source anchoring the studio knows and the renderer does not. */
export type GrassGeography = Pick<
  GrassSite,
  'originX' | 'originY' | 'metersPerFieldUnit' | 'metersPerFrameUnit'
>;

/** One tuft per index; structure-of-arrays keeps tens of thousands of tufts cheap. */
export interface GrassInstances {
  count: number;
  x: Float32Array;
  y: Float32Array;
  elevation: Float32Array;
  rotation: Float32Array;
  /** Per-tuft length jitter in [−1, 1], scaled by the style's length variation. */
  lengthJitter: Float32Array;
  /** Per-tuft colour jitter in [−1, 1]. */
  shade: Float32Array;
  /** Smooth patch noise in [0, 1]; the shader turns its high end into dry grass. */
  patch: Float32Array;
}

type GrassPlacementStyle = Pick<
  GrassStyle,
  'density' | 'coverage' | 'clumping' | 'slopeLimitDegrees' | 'altitudeLimit'
>;

/** Candidate spacing in source-frame units; finer cells only add rejected candidates. */
export const grassCellUnits = 2;
export const maximumGrassTufts = 30_000;

const grassSeed = 0x6a55;

/**
 * Seeded, source-anchored tufts. Every candidate keeps its own rank, so raising density only adds
 * tufts and moving the crop only reveals or hides them; nothing already placed moves.
 */
export function placeGrass(site: GrassSite, style: GrassPlacementStyle): GrassInstances {
  const instances = createInstances(maximumGrassTufts);
  const cellAreaMm2 = (grassCellUnits / site.frameUnitsPerMm) ** 2;
  // Density is tufts per square centimetre of printed model.
  const requestedProbability = Math.min(1, (style.density / 100) * cellAreaMm2);
  const cellCount =
    Math.ceil(site.width / grassCellUnits) * Math.ceil(site.height / grassCellUnits);
  // Thinning by rank keeps a stable, even subset; stopping at the cap would leave the far rows bare.
  // 90% of the cap leaves room for chance, so the hard stop below never truncates the far rows.
  const keepProbability =
    requestedProbability *
    Math.min(1, (maximumGrassTufts * 0.9) / (cellCount * requestedProbability));

  if (keepProbability <= 0 || style.coverage <= 0) {
    return instances;
  }

  const [minimum, maximum] = getFieldRange(site.field);
  const roads = createRoadIndex(site.roads);
  const patchScale = 0.004 + (1 - style.clumping) * 0.01;
  const patchSoftness = 0.04 + (1 - style.clumping) * 0.3;
  const firstColumn = Math.floor(site.originX / grassCellUnits);
  const firstRow = Math.floor(site.originY / grassCellUnits);
  const lastColumn = Math.ceil((site.originX + site.width) / grassCellUnits);
  const lastRow = Math.ceil((site.originY + site.height) / grassCellUnits);

  for (let row = firstRow; row < lastRow; row++) {
    for (
      let column = firstColumn;
      column < lastColumn && instances.count < maximumGrassTufts;
      column++
    ) {
      const rank = hashCell(column, row, 1);

      // Cheap rejection first: most candidates lose to density before any terrain lookups.
      if (rank >= keepProbability) {
        continue;
      }

      const sourceX = (column + hashCell(column, row, 2)) * grassCellUnits;
      const sourceY = (row + hashCell(column, row, 3)) * grassCellUnits;
      const x = sourceX - site.originX;
      const y = sourceY - site.originY;

      if (!isInsideFootprint(x, y, site)) {
        continue;
      }

      const elevation = sampleHeightField(site.field, x, y);
      const patch = fractalNoise(sourceX * patchScale, sourceY * patchScale, 11);
      const coverage = smoothstep(
        1 - style.coverage - patchSoftness,
        1 - style.coverage + patchSoftness,
        patch,
      );
      const weight =
        coverage *
        getSlopeWeight(site, x, y, style.slopeLimitDegrees) *
        getAltitudeWeight(elevation, minimum, maximum, style.altitudeLimit);

      if (
        rank >= keepProbability * weight ||
        (site.seaLevel !== undefined && elevation <= site.seaLevel) ||
        roads.covers(x, y)
      ) {
        continue;
      }

      const index = instances.count++;

      instances.x[index] = x;
      instances.y[index] = y;
      instances.elevation[index] = elevation;
      instances.rotation[index] = hashCell(column, row, 4) * Math.PI * 2;
      instances.lengthJitter[index] = hashCell(column, row, 5) * 2 - 1;
      instances.shade[index] = hashCell(column, row, 6) * 2 - 1;
      instances.patch[index] = fractalNoise(sourceX * 0.012, sourceY * 0.012, 23);
    }
  }

  return instances;
}

// === HELPERS ===

function createInstances(capacity: number): GrassInstances {
  return {
    count: 0,
    x: new Float32Array(capacity),
    y: new Float32Array(capacity),
    elevation: new Float32Array(capacity),
    rotation: new Float32Array(capacity),
    lengthJitter: new Float32Array(capacity),
    shade: new Float32Array(capacity),
    patch: new Float32Array(capacity),
  };
}

function isInsideFootprint(x: number, y: number, site: GrassSite): boolean {
  if (site.shape === 'circle') {
    const radius = site.width / 2;

    return Math.hypot(x - radius, y - radius) <= radius;
  }

  return x >= 0 && x <= site.width && y >= 0 && y <= site.height;
}

/** Fades out over the 10° below the limit, measured on the real, unexaggerated slope. */
function getSlopeWeight(site: GrassSite, x: number, y: number, limitDegrees: number): number {
  const step = site.field.spacing;
  const dx =
    sampleHeightField(site.field, x + step, y) - sampleHeightField(site.field, x - step, y);
  const dy =
    sampleHeightField(site.field, x, y + step) - sampleHeightField(site.field, x, y - step);
  const rise = Math.hypot(dx, dy) * site.metersPerFieldUnit;
  const run = 2 * step * site.metersPerFrameUnit;
  const slopeDegrees = (Math.atan2(rise, run) * 180) / Math.PI;

  return 1 - smoothstep(limitDegrees - 10, limitDegrees, slopeDegrees);
}

/** Fades out over the tenth of the relief below the limit; 1 keeps grass on the summits. */
function getAltitudeWeight(
  elevation: number,
  minimum: number,
  maximum: number,
  limit: number,
): number {
  if (limit >= 1) {
    return 1;
  }

  const relative = (elevation - minimum) / Math.max(1e-9, maximum - minimum);

  return 1 - smoothstep(limit - 0.1, limit, relative);
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

/** Buckets road segments so each tuft checks only the roads near it. */
function createRoadIndex(roads: GrassSite['roads']): { covers: (x: number, y: number) => boolean } {
  const bucketUnits = 16;
  const buckets = new Map<
    string,
    { ax: number; ay: number; bx: number; by: number; r: number }[]
  >();

  for (const road of roads) {
    // A little clearance either side keeps blades off the asphalt edge.
    const reach = road.halfWidth * 1.4;

    for (let index = 1; index < road.points.length; index++) {
      const a = road.points[index - 1];
      const b = road.points[index];
      const segment = { ax: a.x, ay: a.y, bx: b.x, by: b.y, r: reach };

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
          const key = `${gx},${gy}`;
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
      const bucket = buckets.get(`${Math.floor(x / bucketUnits)},${Math.floor(y / bucketUnits)}`);

      return (
        bucket?.some(
          (segment) =>
            distanceToSegment(x, y, segment.ax, segment.ay, segment.bx, segment.by) < segment.r,
        ) ?? false
      );
    },
  };
}

function distanceToSegment(
  x: number,
  y: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSquared));

  return Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
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
