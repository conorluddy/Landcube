import { getRoadHalfWidth } from './road-ribbons';
import { roadDetailClasses } from './constants/roads';
import type { TerrainCropShape } from './terrain-crop';
import type { HeightField } from './types/terrain';
import type { RoadPath, RoadStyle } from './types/roads';

/** Where decorations may go: the model crop plus the geography that rules places out. */
export interface DecorationSite {
  field: HeightField;
  width: number;
  height: number;
  shape: TerrainCropShape;
  /** The crop's offset in the source frame; decorations are anchored there so crops never reshape them. */
  originX: number;
  originY: number;
  frameUnitsPerMm: number;
  /** Real-world scale, so slope limits use true slopes rather than exaggerated ones. */
  metersPerFieldUnit: number;
  metersPerFrameUnit: number;
  /** Field elevation at or below which ground counts as sea. */
  seaLevel?: number;
  /** Road centrelines in crop units with their half-widths; decorations keep off them. */
  roads: readonly { points: readonly { x: number; y: number }[]; halfWidth: number }[];
}

/** The real-world scale and source anchoring the studio knows and the renderer does not. */
export type DecorationGeography = Pick<
  DecorationSite,
  'originX' | 'originY' | 'metersPerFieldUnit' | 'metersPerFrameUnit'
>;

// Grass and rocks share one seed and keep apart by salt, so layers never share a pattern by chance.
const decorationSeed = 0x6a55;

/** Drawn roads as decoration clearances, matching the ribbons' classes and widths; none when off. */
export function getDecorationRoads(
  paths: readonly RoadPath[],
  style: Pick<RoadStyle, 'enabled' | 'detail' | 'widthMm'>,
  frameUnitsPerMm: number,
): DecorationSite['roads'] {
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

export function isInsideFootprint(
  x: number,
  y: number,
  site: Pick<DecorationSite, 'shape' | 'width' | 'height'>,
): boolean {
  if (site.shape === 'circle') {
    const radius = site.width / 2;

    return Math.hypot(x - radius, y - radius) <= radius;
  }

  return x >= 0 && x <= site.width && y >= 0 && y <= site.height;
}

export function getFieldRange(field: HeightField): [number, number] {
  let minimum = Infinity;
  let maximum = -Infinity;

  for (const value of field.values) {
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }

  return [minimum, maximum];
}

/** Buckets road segments so each point checks only the roads near it. */
export function createRoadIndex(roads: DecorationSite['roads']): {
  covers: (x: number, y: number) => boolean;
} {
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
export function hashCell(column: number, row: number, salt: number): number {
  let hash =
    Math.imul(column, 0x27d4eb2d) ^
    Math.imul(row, 0x165667b1) ^
    Math.imul(salt + decorationSeed, 0x9e3779b1);

  hash = Math.imul(hash ^ (hash >>> 15), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  hash ^= hash >>> 16;

  return (hash >>> 0) / 4294967296;
}

/** Two-octave value noise in [0, 1], seeded by `salt`. */
export function fractalNoise(x: number, y: number, salt: number): number {
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

export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - edge0) / Math.max(1e-9, edge1 - edge0)));

  return t * t * (3 - 2 * t);
}
