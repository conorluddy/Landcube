/*
 * Route sampling for terrain analysis. Platform-free. Short inputs are densified along ground
 * distance with every waypoint kept as a sample; inputs at the sample cap or above (big imported
 * tracks) are decimated by cumulative distance over their original points instead, so they are
 * never densified past the cap. Positions interpolate linearly in latitude/longitude within a
 * segment: at sample spacings of tens of metres the drift from the great circle is millimetres,
 * far below source resolution, and distances still follow the haversine segment length.
 */
import { maximumRouteSamples, minimumSampleSpacingMeters } from './constants/route-analysis';
import type { GeoPoint } from './types/terrain-analysis';

export interface RouteSample {
  /** Cumulative ground distance from the start, along the original points. */
  distanceMeters: number;
  point: GeoPoint;
}

export interface RouteSampling {
  samples: RouteSample[];
  /** Nominal interval. Densified intervals never exceed it; decimated ones follow the input. */
  spacingMeters: number;
  strategy: 'densified' | 'decimated';
}

// Mean Earth radius; `src/gpx.ts` measures with this module too.
const earthRadiusMeters = 6371008.8;

// === PUBLIC API ===

/** Samples `points` at no finer than `resolutionMeters` (or 10 m), within the sample cap. */
export function sampleRoute(points: readonly GeoPoint[], resolutionMeters: number): RouteSampling {
  const segmentMeters = measureSegments(points);
  const totalMeters = segmentMeters.reduce((sum, meters) => sum + meters, 0);
  const baseSpacingMeters = Math.max(resolutionMeters, minimumSampleSpacingMeters);

  if (points.length >= maximumRouteSamples) {
    return decimateRoute(points, segmentMeters, totalMeters);
  }

  // Densifying adds at most one sample per segment beyond distance/spacing, so reserving one
  // slot per waypoint keeps the total within the cap.
  const spacingMeters = Math.max(
    baseSpacingMeters,
    totalMeters / (maximumRouteSamples - points.length),
  );

  return {
    samples: densifyRoute(points, segmentMeters, spacingMeters),
    spacingMeters,
    strategy: 'densified',
  };
}

export function measureGroundMeters(start: GeoPoint, end: GeoPoint): number {
  const toRadians = Math.PI / 180;
  const deltaLatitude = (end.latitude - start.latitude) * toRadians;
  const deltaLongitude = (end.longitude - start.longitude) * toRadians;
  const h =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(start.latitude * toRadians) *
      Math.cos(end.latitude * toRadians) *
      Math.sin(deltaLongitude / 2) ** 2;

  return 2 * earthRadiusMeters * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The point `distanceMeters` along the route by cumulative ground distance, as profile samples
 * are placed. Distances beyond either end clamp to it; fewer than two points have no length.
 */
export function locateRouteDistance(
  points: readonly GeoPoint[],
  distanceMeters: number,
): GeoPoint | undefined {
  if (!Number.isFinite(distanceMeters)) {
    throw new RangeError(
      `Route distance must be a finite number of metres, got ${distanceMeters}.`,
    );
  }

  if (points.length < 2) {
    return undefined;
  }

  let startMeters = 0;

  for (let index = 1; index < points.length; index += 1) {
    const lengthMeters = measureGroundMeters(points[index - 1], points[index]);

    if (distanceMeters < startMeters + lengthMeters) {
      const fraction = Math.max(0, (distanceMeters - startMeters) / lengthMeters);

      return interpolatePoint(points[index - 1], points[index], fraction);
    }

    startMeters += lengthMeters;
  }

  return copyPoint(points[points.length - 1]);
}

// === HELPERS ===

function measureSegments(points: readonly GeoPoint[]): number[] {
  return points.slice(1).map((point, index) => measureGroundMeters(points[index], point));
}

function densifyRoute(
  points: readonly GeoPoint[],
  segmentMeters: readonly number[],
  spacingMeters: number,
): RouteSample[] {
  if (points.length === 0) {
    return [];
  }

  const samples: RouteSample[] = [{ distanceMeters: 0, point: copyPoint(points[0]) }];
  let cumulativeMeters = 0;

  segmentMeters.forEach((lengthMeters, index) => {
    const start = points[index];
    const end = points[index + 1];
    const subdivisions = Math.max(1, Math.ceil(lengthMeters / spacingMeters));

    for (let step = 1; step < subdivisions; step += 1) {
      const fraction = step / subdivisions;

      samples.push({
        distanceMeters: cumulativeMeters + lengthMeters * fraction,
        point: interpolatePoint(start, end, fraction),
      });
    }

    cumulativeMeters += lengthMeters;
    samples.push({ distanceMeters: cumulativeMeters, point: copyPoint(end) });
  });

  return samples;
}

/** Keeps original points at least `spacing` apart, plus both ends: at most the cap. */
function decimateRoute(
  points: readonly GeoPoint[],
  segmentMeters: readonly number[],
  totalMeters: number,
): RouteSampling {
  // Two slots are reserved for the ends; a zero-length route keeps only them.
  const spacingMeters = totalMeters > 0 ? totalMeters / (maximumRouteSamples - 2) : Infinity;
  const samples: RouteSample[] = [{ distanceMeters: 0, point: copyPoint(points[0]) }];
  let cumulativeMeters = 0;
  let lastKeptMeters = 0;

  for (let index = 1; index < points.length - 1; index += 1) {
    cumulativeMeters += segmentMeters[index - 1];

    if (cumulativeMeters - lastKeptMeters >= spacingMeters) {
      samples.push({ distanceMeters: cumulativeMeters, point: copyPoint(points[index]) });
      lastKeptMeters = cumulativeMeters;
    }
  }

  samples.push({ distanceMeters: totalMeters, point: copyPoint(points[points.length - 1]) });

  return {
    samples,
    spacingMeters: Number.isFinite(spacingMeters) ? spacingMeters : 0,
    strategy: 'decimated',
  };
}

function interpolatePoint(start: GeoPoint, end: GeoPoint, fraction: number): GeoPoint {
  // Take the short way round so segments crossing the antimeridian stay on the route.
  const deltaLongitude = ((((end.longitude - start.longitude) % 360) + 540) % 360) - 180;
  const longitude = start.longitude + deltaLongitude * fraction;

  return {
    latitude: start.latitude + (end.latitude - start.latitude) * fraction,
    longitude: longitude > 180 ? longitude - 360 : longitude < -180 ? longitude + 360 : longitude,
  };
}

/** Drops extra fields (recorded GPX elevations) so samples never alias input objects. */
function copyPoint({ latitude, longitude }: GeoPoint): GeoPoint {
  return { latitude, longitude };
}
