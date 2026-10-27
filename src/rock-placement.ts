import {
  createRoadIndex,
  fractalNoise,
  getFieldRange,
  hashCell,
  isInsideFootprint,
  smoothstep,
  type DecorationSite,
} from './decoration-field';
import { sampleHeightField } from './terrain-surface';
import type { RockStyle } from './types/rocks';

/** One rock per index; structure-of-arrays keeps thousands of rocks cheap to pose. */
export interface RockInstances {
  count: number;
  /** Crop-frame position of the rock's centre. */
  x: Float32Array;
  y: Float32Array;
  elevation: Float32Array;
  sizeMm: Float32Array;
  /** Turn about the vertical, in radians. */
  yaw: Float32Array;
  /** Which shape in the bank this rock uses. */
  shape: Uint8Array;
  /** Per-rock brightness jitter in [−1, 1]. */
  shade: Float32Array;
}

type RockPlacementStyle = Pick<
  RockStyle,
  'rocksPerSquareCm' | 'minimumSizeMm' | 'maximumSizeMm' | 'clustering' | 'slopePreference'
>;

/** Distinct rock shapes; each rock picks one, so the bank never repeats in an obvious pattern. */
export const rockShapeCount = 6;
export const maximumRocks = 6000;

/** One candidate per printed square millimetre: far finer than any useful rock density. */
const candidateCellMm = 1;
/** Boulder fields about 15 mm across on the printed model. */
const clustersPerMm = 0.06;
// Salts keep rocks independent of grass, which uses the low salts.
const rockSalt = 100;

/**
 * Seeded rocks anchored in source-frame millimetres. Every candidate keeps its own rank, so raising
 * density only adds rocks and moving the crop only reveals or hides them. Boulders gather where
 * cluster noise peaks; small stones scatter everywhere else.
 */
export function placeRocks(site: DecorationSite, style: RockPlacementStyle): RockInstances {
  const instances = createInstances(maximumRocks);
  const cellUnits = candidateCellMm * site.frameUnitsPerMm;
  const requestedProbability = Math.min(1, (style.rocksPerSquareCm / 100) * candidateCellMm ** 2);
  const cellCount = Math.ceil(site.width / cellUnits) * Math.ceil(site.height / cellUnits);
  // Thinning by rank keeps an even subset; stopping at the cap would leave the far rows bare.
  const keepProbability =
    requestedProbability *
    Math.min(1, (maximumRocks * 0.9) / Math.max(1, cellCount * requestedProbability));

  if (keepProbability <= 0) {
    return instances;
  }

  const [minimum, maximum] = getFieldRange(site.field);
  // Roads clear the largest rock's radius too, so no boulder overhangs the asphalt.
  const largestRadiusUnits = (style.maximumSizeMm / 2) * site.frameUnitsPerMm;
  const roads = createRoadIndex(
    site.roads.map((road) => ({ ...road, halfWidth: road.halfWidth + largestRadiusUnits / 1.4 })),
  );
  const firstColumn = Math.floor(site.originX / cellUnits);
  const firstRow = Math.floor(site.originY / cellUnits);
  const lastColumn = Math.ceil((site.originX + site.width) / cellUnits);
  const lastRow = Math.ceil((site.originY + site.height) / cellUnits);

  for (let row = firstRow; row < lastRow; row++) {
    for (
      let column = firstColumn;
      column < lastColumn && instances.count < maximumRocks;
      column++
    ) {
      const rank = hashCell(column, row, rockSalt);

      // Cheap rejection first: no weight exceeds 3.6, so these candidates lose whatever the ground.
      if (rank >= keepProbability * 3.6) {
        continue;
      }

      const sourceXMm = (column + hashCell(column, row, rockSalt + 1)) * candidateCellMm;
      const sourceYMm = (row + hashCell(column, row, rockSalt + 2)) * candidateCellMm;
      const x = sourceXMm * site.frameUnitsPerMm - site.originX;
      const y = sourceYMm * site.frameUnitsPerMm - site.originY;

      if (!isInsideFootprint(x, y, site)) {
        continue;
      }

      const elevation = sampleHeightField(site.field, x, y);
      const core = smoothstep(
        0.5,
        0.78,
        fractalNoise(sourceXMm * clustersPerMm, sourceYMm * clustersPerMm, rockSalt + 3),
      );
      const weight =
        getClusterWeight(core, style.clustering) *
        getHabitatWeight(getSlopeDegrees(site, x, y), style.slopePreference) *
        getAltitudeWeight(elevation, minimum, maximum);

      if (
        rank >= keepProbability * weight ||
        (site.seaLevel !== undefined && elevation <= site.seaLevel) ||
        roads.covers(x, y)
      ) {
        continue;
      }

      // Most rocks are small; boulder sizes come mainly from cluster cores.
      const sizeExponent = 3.2 - 1.9 * core * style.clustering;
      const sizeFraction = hashCell(column, row, rockSalt + 4) ** sizeExponent;
      const index = instances.count++;

      instances.x[index] = x;
      instances.y[index] = y;
      instances.elevation[index] = elevation;
      instances.sizeMm[index] =
        style.minimumSizeMm + (style.maximumSizeMm - style.minimumSizeMm) * sizeFraction;
      instances.yaw[index] = hashCell(column, row, rockSalt + 5) * Math.PI * 2;
      instances.shape[index] = Math.floor(hashCell(column, row, rockSalt + 6) * rockShapeCount);
      instances.shade[index] = hashCell(column, row, rockSalt + 7) * 2 - 1;
    }
  }

  return instances;
}

// === HELPERS ===

function createInstances(capacity: number): RockInstances {
  return {
    count: 0,
    x: new Float32Array(capacity),
    y: new Float32Array(capacity),
    elevation: new Float32Array(capacity),
    sizeMm: new Float32Array(capacity),
    yaw: new Float32Array(capacity),
    shape: new Uint8Array(capacity),
    shade: new Float32Array(capacity),
  };
}

/** Clustering moves rocks from the open into fields, keeping roughly the same total. */
function getClusterWeight(core: number, clustering: number): number {
  return 1 + clustering * (0.12 + 2.6 * core - 1);
}

/** Rocks gather on steep ground and thin out on cliffs too sheer to hold them. */
function getHabitatWeight(slopeDegrees: number, slopePreference: number): number {
  const steep = 0.15 + 0.85 * smoothstep(12, 38, slopeDegrees);

  return (1 + slopePreference * (steep - 1)) * (1 - smoothstep(58, 70, slopeDegrees));
}

/** Summits are a little rockier than valley floors. */
function getAltitudeWeight(elevation: number, minimum: number, maximum: number): number {
  const relative = (elevation - minimum) / Math.max(1e-9, maximum - minimum);

  return 0.7 + 0.6 * relative;
}

/** The real, unexaggerated slope, so exaggeration never moves rocks. */
function getSlopeDegrees(site: DecorationSite, x: number, y: number): number {
  const step = site.field.spacing;
  const dx =
    sampleHeightField(site.field, x + step, y) - sampleHeightField(site.field, x - step, y);
  const dy =
    sampleHeightField(site.field, x, y + step) - sampleHeightField(site.field, x, y - step);
  const rise = Math.hypot(dx, dy) * site.metersPerFieldUnit;
  const run = 2 * step * site.metersPerFrameUnit;

  return (Math.atan2(rise, run) * 180) / Math.PI;
}
