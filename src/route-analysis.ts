/*
 * Route analysis: ground and terrain-following distance, ascent/descent, grade and steep sections
 * over source elevations. Platform-free and deterministic. Elevation deltas are raw sample
 * differences (no smoothing or hysteresis), so totals are exact on synthetic fixtures and
 * bounded by source resolution on real terrain. Coverage gaps are never bridged: deltas, surface
 * distance and grade windows touching an uncovered sample contribute nothing.
 */
import { operationErrorCodes } from './constants/operations';
import {
  maximumSlopeThresholdPercent,
  minimumGradeWindowMeters,
  minimumSlopeThresholdPercent,
} from './constants/route-analysis';
import { sampleRoute, type RouteSample } from './route-sampling';
import type { Result } from './types/operations';
import type {
  GeoPoint,
  ProfileSample,
  RouteAnalysis,
  SourceElevationSampler,
  SteepSection,
} from './types/terrain-analysis';

/** Fewer than two points is a route still being drawn, not a failure (REQ-38). */
export type RouteAnalysisOutcome =
  { kind: 'incomplete'; pointCount: number } | { kind: 'analysed'; analysis: RouteAnalysis };

export interface RouteAnalysisOptions {
  /** 1..100; validate user input with `validateSlopeThresholdPercent` first. */
  slopeThresholdPercent: number;
}

export type RouteAnalyser = (
  points: readonly GeoPoint[],
  sampler: SourceElevationSampler | undefined,
  options: RouteAnalysisOptions,
) => RouteAnalysisOutcome;

// Absorbs floating-point noise so fixtures sitting exactly on a threshold or window edge, and
// their reversals, classify the same way.
const gradeTolerancePercent = 1e-6;
const windowToleranceMeters = 1e-6;

// === PUBLIC API ===

/**
 * Analyses `points` in travel order (imported routes: pass the original points). Without a
 * sampler (procedural terrain) only ground distance is available.
 */
export const analyseRoute: RouteAnalyser = (points, sampler, options) => {
  assertSlopeThreshold(options.slopeThresholdPercent);

  if (points.length < 2) {
    return { kind: 'incomplete', pointCount: points.length };
  }

  const { samples, spacingMeters } = sampleRoute(points, sampler?.resolutionMeters ?? 0);
  const elevations = samples.map(({ point }) => readElevation(sampler, point));
  const windowMeters = Math.max(minimumGradeWindowMeters, 2 * spacingMeters);
  const grades = measureGrades(samples, elevations, windowMeters);
  const profileSamples = samples.map((sample, index) =>
    toProfileSample(sample, elevations[index], grades[index]),
  );

  return {
    kind: 'analysed',
    analysis: {
      groundMeters: samples[samples.length - 1].distanceMeters,
      ...sumElevationTotals(samples, elevations),
      isPartial: elevations.some((elevation) => elevation === undefined),
      samples: profileSamples,
      steepSections: findSteepSections(samples, grades, options.slopeThresholdPercent),
    },
  };
};

/** Memoises the latest analysis by geometry, sampler revision and threshold. */
export function createRouteAnalysisCache(): RouteAnalyser {
  let latest:
    | {
        coordinates: Float64Array;
        revision: string | undefined;
        slopeThresholdPercent: number;
        outcome: RouteAnalysisOutcome;
      }
    | undefined;

  return (points, sampler, options) => {
    if (
      latest &&
      latest.revision === sampler?.revision &&
      latest.slopeThresholdPercent === options.slopeThresholdPercent &&
      hasSameCoordinates(latest.coordinates, points)
    ) {
      return latest.outcome;
    }

    const outcome = analyseRoute(points, sampler, options);

    latest = {
      coordinates: snapshotCoordinates(points),
      revision: sampler?.revision,
      slopeThresholdPercent: options.slopeThresholdPercent,
      outcome,
    };

    return outcome;
  };
}

/** Boundary check for user-entered thresholds (REQ-28): 1% through 100% inclusive. */
export function validateSlopeThresholdPercent(value: number): Result<number> {
  if (isSlopeThreshold(value)) {
    return { ok: true, data: value };
  }

  return {
    ok: false,
    error: {
      code: operationErrorCodes.invalidRoute,
      message: `Slope threshold must be from ${minimumSlopeThresholdPercent}% to ${maximumSlopeThresholdPercent}%; got ${value}%.`,
      retryable: false,
    },
  };
}

// === HELPERS ===

function isSlopeThreshold(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= minimumSlopeThresholdPercent &&
    value <= maximumSlopeThresholdPercent
  );
}

function assertSlopeThreshold(value: number): void {
  if (!isSlopeThreshold(value)) {
    throw new RangeError(
      `Route analysis needs a slope threshold from ${minimumSlopeThresholdPercent} to ${maximumSlopeThresholdPercent}%, got ${value}. Validate input with validateSlopeThresholdPercent.`,
    );
  }
}

function readElevation(
  sampler: SourceElevationSampler | undefined,
  point: GeoPoint,
): number | undefined {
  const elevationMeters = sampler?.sampleMeters(point);

  return elevationMeters !== undefined && Number.isFinite(elevationMeters)
    ? elevationMeters
    : undefined;
}

function sumElevationTotals(
  samples: readonly RouteSample[],
  elevations: readonly (number | undefined)[],
): Pick<RouteAnalysis, 'surfaceMeters' | 'ascentMeters' | 'descentMeters' | 'netMeters'> {
  let surfaceMeters = 0;
  let ascentMeters = 0;
  let descentMeters = 0;
  let firstCovered: number | undefined;
  let lastCovered: number | undefined;

  elevations.forEach((elevation, index) => {
    if (elevation === undefined) {
      return;
    }

    firstCovered ??= elevation;
    lastCovered = elevation;
    const previous = index > 0 ? elevations[index - 1] : undefined;

    if (previous === undefined) {
      return;
    }

    const riseMeters = elevation - previous;
    const groundMeters = samples[index].distanceMeters - samples[index - 1].distanceMeters;

    surfaceMeters += Math.hypot(groundMeters, riseMeters);
    ascentMeters += Math.max(0, riseMeters);
    descentMeters += Math.max(0, -riseMeters);
  });

  if (firstCovered === undefined || lastCovered === undefined) {
    return {};
  }

  return { surfaceMeters, ascentMeters, descentMeters, netMeters: lastCovered - firstCovered };
}

/** Centred window, clipped (one-sided) at the ends; undefined if any sample in it is uncovered. */
function measureGrades(
  samples: readonly RouteSample[],
  elevations: readonly (number | undefined)[],
  windowMeters: number,
): (number | undefined)[] {
  const halfWindowMeters = windowMeters / 2 - windowToleranceMeters;
  const uncoveredBefore = countUncoveredPrefix(elevations);
  const lastIndex = samples.length - 1;
  let start = 0;
  let end = 0;

  return samples.map(({ distanceMeters }, index) => {
    // Endpoints are the nearest samples at or beyond each half-window, so the window is never
    // narrower than asked for, and always reaches a neighbour across wide decimated intervals.
    while (
      start < index &&
      samples[start + 1].distanceMeters <= distanceMeters - halfWindowMeters
    ) {
      start += 1;
    }

    end = Math.max(end, index);

    while (end < lastIndex && samples[end].distanceMeters < distanceMeters + halfWindowMeters) {
      end += 1;
    }

    const runMeters = samples[end].distanceMeters - samples[start].distanceMeters;
    const startElevation = elevations[start];
    const endElevation = elevations[end];

    if (
      runMeters <= 0 ||
      startElevation === undefined ||
      endElevation === undefined ||
      uncoveredBefore[end + 1] - uncoveredBefore[start] > 0
    ) {
      return undefined;
    }

    return ((endElevation - startElevation) / runMeters) * 100;
  });
}

function countUncoveredPrefix(elevations: readonly (number | undefined)[]): number[] {
  const counts = [0];

  elevations.forEach((elevation, index) => {
    counts.push(counts[index] + (elevation === undefined ? 1 : 0));
  });

  return counts;
}

/** Contiguous samples at or above the threshold in one direction; a lone sample spans 0 m. */
function findSteepSections(
  samples: readonly RouteSample[],
  grades: readonly (number | undefined)[],
  slopeThresholdPercent: number,
): SteepSection[] {
  const sections: SteepSection[] = [];
  let open: SteepSection | undefined;

  grades.forEach((grade, index) => {
    const direction = classifyGrade(grade, slopeThresholdPercent);
    const distanceMeters = samples[index].distanceMeters;

    if (open && open.direction === direction) {
      open.endMeters = distanceMeters;

      return;
    }

    open = direction
      ? { startMeters: distanceMeters, endMeters: distanceMeters, direction }
      : undefined;

    if (open) {
      sections.push(open);
    }
  });

  return sections;
}

function classifyGrade(
  grade: number | undefined,
  slopeThresholdPercent: number,
): SteepSection['direction'] | undefined {
  if (grade === undefined || Math.abs(grade) < slopeThresholdPercent - gradeTolerancePercent) {
    return undefined;
  }

  return grade > 0 ? 'climb' : 'descent';
}

function toProfileSample(
  { distanceMeters, point }: RouteSample,
  elevationMeters: number | undefined,
  gradePercent: number | undefined,
): ProfileSample {
  return {
    distanceMeters,
    point,
    ...(elevationMeters === undefined ? {} : { elevationMeters }),
    ...(gradePercent === undefined ? {} : { gradePercent }),
  };
}

function snapshotCoordinates(points: readonly GeoPoint[]): Float64Array {
  const coordinates = new Float64Array(points.length * 2);

  points.forEach(({ latitude, longitude }, index) => {
    coordinates[index * 2] = latitude;
    coordinates[index * 2 + 1] = longitude;
  });

  return coordinates;
}

function hasSameCoordinates(coordinates: Float64Array, points: readonly GeoPoint[]): boolean {
  return (
    coordinates.length === points.length * 2 &&
    points.every(
      ({ latitude, longitude }, index) =>
        coordinates[index * 2] === latitude && coordinates[index * 2 + 1] === longitude,
    )
  );
}
