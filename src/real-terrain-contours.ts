import { extractContours, simplifyContours } from './contour-extraction';
import { getTerrainDetailProfile } from './constants/terrain-detail';
import type { Contour } from './types/contours';
import type { HeightField } from './types/terrain';
import type { RealTerrain } from './real-terrain';

export type RealContourInterval = 'auto' | 'density' | number;
export const maximumRealContourLevels = 2048;

export function validateRealContourInterval(
  interval: unknown,
): asserts interval is RealContourInterval | undefined {
  if (interval === undefined || interval === 'auto' || interval === 'density') {
    return;
  }

  if (
    typeof interval !== 'number' ||
    !Number.isFinite(interval) ||
    interval < 1 ||
    interval > 5000
  ) {
    throw new Error('Contour interval must be auto, density, or a number from 1 to 5000 meters.');
  }
}

/** Chooses readable 1/2/2.5/5 intervals, targeting about forty levels per loaded area. */
export function getRealContourInterval(terrain: RealTerrain | undefined): number | undefined {
  if (
    !terrain?.elevations ||
    terrain.contourInterval === undefined ||
    terrain.contourInterval === 'density'
  ) {
    return undefined;
  }

  validateRealContourInterval(terrain.contourInterval);
  const { minimumMeters, maximumMeters } = terrain.elevations;
  const range = maximumMeters - minimumMeters;
  let interval = terrain.contourInterval;

  if (interval === 'auto') {
    const target = Math.max(1, range / 40);
    const magnitude = 10 ** Math.floor(Math.log10(target));
    const step = [1, 2, 2.5, 5, 10].find((value) => value * magnitude >= target) ?? 10;

    interval = step * magnitude;
  }

  if (
    Math.floor(maximumMeters / interval) - Math.ceil(minimumMeters / interval) + 1 >
    maximumRealContourLevels
  ) {
    throw new Error(
      `Contour interval is too small for this area. Choose at least ${Math.max(1, Math.ceil(range / (maximumRealContourLevels - 1)))} meters.`,
    );
  }

  return interval;
}

/** Converts sea-level-anchored meter levels into the unchanged terrain normalization. */
export function getRealContourElevations(terrain: RealTerrain | undefined): number[] | undefined {
  const interval = getRealContourInterval(terrain);

  if (interval === undefined || !terrain?.elevations) {
    return undefined;
  }

  const { minimumMeters, maximumMeters, originMeters, metersPerUnit } = terrain.elevations;
  const first = Math.ceil(minimumMeters / interval);
  const last = Math.floor(maximumMeters / interval);

  return Array.from(
    { length: Math.max(0, last - first + 1) },
    (_, i) => ((first + i) * interval - originMeters) / metersPerUnit,
  );
}

/** Keeps physical elevations separate from the normalized heights used for rendering. */
export function extractLandscapeContours(
  field: HeightField,
  levels: readonly number[],
  terrain?: RealTerrain,
): Contour[] {
  const profile = getTerrainDetailProfile(terrain?.detail);
  // Denser detail fields trace far more vertices than the output can show.
  const contours = profile
    ? simplifyContours(extractContours(field, levels), profile.simplifyTolerance)
    : extractContours(field, levels);
  const interval = getRealContourInterval(terrain);

  if (interval !== undefined && terrain?.elevations) {
    const { originMeters, metersPerUnit } = terrain.elevations;

    for (const contour of contours) {
      contour.intervalMeters = interval;
      contour.elevationMeters =
        Math.round((contour.elevation * metersPerUnit + originMeters) / interval) * interval;
    }
  }

  return contours;
}
