/**
 * Contracts for terrain measurement and routes (docs/PRD/terrain-measurement-and-routes.md).
 * Elevations here are source metres: repaired, unclipped by the depth floor, and independent of
 * any display transform (exaggeration, terraces, framing).
 */
import type { RoutePoint, RouteWaypoint } from './route';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/** Degrees; the patch the loaded elevation grid covers. */
export interface GeoCoverage {
  north: number;
  south: number;
  east: number;
  west: number;
}

/** Real-terrain source elevations in metres by place. Procedural terrain has none. */
export interface SourceElevationSampler {
  /** Deterministic for the loaded dataset: location, span, floor and depth. Keys analysis caches. */
  revision: string;
  /** Ground distance between neighbouring grid samples. */
  resolutionMeters: number;
  coverage: GeoCoverage;
  /** Bilinear metres; undefined outside coverage or where the source has no data. */
  sampleMeters(point: GeoPoint): number | undefined;
}

export type RouteProvenance = 'drawn' | 'imported';

/** The one route in the session: drawn on the terrain or imported from GPX. */
export interface ActiveRoute {
  id: string;
  name: string;
  provenance: RouteProvenance;
  /** Display and editing geometry, in travel order. Imported routes hold the simplified copy. */
  waypoints: GeoPoint[];
  /** Imported routes only: every recorded point with its recorded elevation. Session-only. */
  originalPoints?: RoutePoint[];
  namedWaypoints: RouteWaypoint[];
  /** Grades at or above this magnitude count as steep. 1..100, default 15. */
  slopeThresholdPercent: number;
}

export type RouteEditing =
  { mode: 'drawing' | 'editing'; selectedIndex?: number } | { mode: 'viewing' };

export interface ProfileSample {
  /** Cumulative ground distance from the start. */
  distanceMeters: number;
  point: GeoPoint;
  /** Undefined where the source has no coverage; gaps are never bridged. */
  elevationMeters?: number;
  gradePercent?: number;
}

export interface SteepSection {
  startMeters: number;
  endMeters: number;
  direction: 'climb' | 'descent';
}

/** Terrain-derived; elevation totals are absent when no sample has coverage. */
export interface RouteAnalysis {
  groundMeters: number;
  surfaceMeters?: number;
  ascentMeters?: number;
  descentMeters?: number;
  netMeters?: number;
  /** Some samples fell outside coverage; totals cover only the sampled parts. */
  isPartial: boolean;
  samples: ProfileSample[];
  steepSections: SteepSection[];
}
