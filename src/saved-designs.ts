import {
  savedDesignLimit,
  savedDesignsStorageKey,
  savedDesignThumbnailMaxBytes,
} from './constants/library';
import { operationErrorCodes } from './constants/operations';
import { maximumRoutePoints } from './gpx';
import { validateSlopeThresholdPercent } from './route-analysis';
import type { OperationError, Result } from './types/operations';
import type { RoutePoint } from './types/route';
import type { ActiveRoute } from './types/terrain-analysis';

/** The real-terrain location a design was saved at; design links deliberately omit it. */
export interface SavedTerrain {
  latitude: number;
  longitude: number;
  spanKm: number;
  elevationFloor?: number;
  maxDepth?: number;
  /** The place name the location controls show; absent on older entries. */
  place?: string;
}

/**
 * The route as saved: source geometry and settings only. `originalPoints` (recorded elevations)
 * is session-only, and derived profile samples are always recomputed against the restored terrain.
 */
export type SavedRoute = Omit<ActiveRoute, 'originalPoints' | 'waypoints'> & {
  version: 1;
  /** Simplified geometry; imported routes keep each point's recorded elevation where it had one. */
  points: RoutePoint[];
};

/** A design kept in the Library: the design link plus a small preview. Local placeholder until accounts exist. */
export interface SavedDesign {
  id: string;
  name: string;
  /** ISO 8601 timestamp. */
  savedAt: string;
  /** The design link the existing sharing code produces; restoring parses it. */
  link: string;
  /** Preview SVG, at most `savedDesignThumbnailMaxBytes`; null when it was too large or unavailable. */
  thumbnailSvg: string | null;
  source: 'procedural' | 'real';
  /** The seed for procedural designs, the place name for real ones. */
  seedOrPlace: string;
  /** Real terrain only. Absent on generated designs and on entries saved before routes existed. */
  terrain?: SavedTerrain;
  route?: SavedRoute;
}

// === PUBLIC API ===

/**
 * Saved designs, newest first. Corrupt storage is an error result (the Library shows empty with a
 * message); single malformed entries are skipped.
 */
export function readSavedDesigns(storage: Pick<Storage, 'getItem'>): Result<SavedDesign[]> {
  let raw: string | null;

  try {
    raw = storage.getItem(savedDesignsStorageKey);
  } catch {
    return storageFailure('Browser storage is unavailable. The Library is empty for this visit.');
  }

  if (raw === null) {
    return { ok: true, data: [] };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return storageFailure(
      'Saved designs could not be read because stored data is corrupt. Save a design to start a fresh Library.',
    );
  }

  if (!Array.isArray(parsed)) {
    return storageFailure(
      'Saved designs could not be read because stored data is corrupt. Save a design to start a fresh Library.',
    );
  }

  return { ok: true, data: parsed.flatMap((entry) => parseSavedDesign(entry) ?? []) };
}

export function writeSavedDesigns(
  storage: Pick<Storage, 'setItem'>,
  designs: readonly SavedDesign[],
): Result<void> {
  try {
    storage.setItem(savedDesignsStorageKey, JSON.stringify(designs));

    return { ok: true, data: undefined };
  } catch {
    return storageFailure('Could not save the design. It stays in the Library for this visit.');
  }
}

/** Puts `design` first, replacing any entry with the same id, and keeps the newest `savedDesignLimit`. */
export function addSavedDesign(saved: readonly SavedDesign[], design: SavedDesign): SavedDesign[] {
  return [design, ...saved.filter((existing) => existing.id !== design.id)].slice(
    0,
    savedDesignLimit,
  );
}

export function removeSavedDesign(saved: readonly SavedDesign[], id: string): SavedDesign[] {
  return saved.filter((existing) => existing.id !== id);
}

/** The thumbnail when it fits the size budget, otherwise null. */
export function fitThumbnail(svg: string): string | null {
  return new TextEncoder().encode(svg).length <= savedDesignThumbnailMaxBytes ? svg : null;
}

/**
 * Imported routes keep recorded elevations on the simplified points. `simplifyRoute` keeps original
 * vertices in order, so a forward scan finds each one even when coordinates repeat.
 */
export function toSavedRoute(route: ActiveRoute): SavedRoute {
  const { id, name, provenance, waypoints, namedWaypoints, slopeThresholdPercent } = route;
  const recorded = route.originalPoints ?? [];
  let cursor = 0;
  const points = waypoints.map((waypoint): RoutePoint => {
    const found = recorded.findIndex(
      (point, index) =>
        index >= cursor &&
        point.latitude === waypoint.latitude &&
        point.longitude === waypoint.longitude,
    );

    if (found === -1) {
      return { latitude: waypoint.latitude, longitude: waypoint.longitude };
    }

    cursor = found + 1;

    return recorded[found];
  });

  return { version: 1, id, name, provenance, points, namedWaypoints, slopeThresholdPercent };
}

// === HELPERS ===

/**
 * Validates the required fields strictly; the optional `terrain` and `route` are dropped (not the
 * whole design) when malformed or from an unknown version, so older and newer entries stay openable.
 */
function parseSavedDesign(value: unknown): SavedDesign | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const design = value as Record<string, unknown>;

  if (
    typeof design.id !== 'string' ||
    typeof design.name !== 'string' ||
    typeof design.savedAt !== 'string' ||
    typeof design.link !== 'string' ||
    !(design.thumbnailSvg === null || typeof design.thumbnailSvg === 'string') ||
    !(design.source === 'procedural' || design.source === 'real') ||
    typeof design.seedOrPlace !== 'string'
  ) {
    return null;
  }

  const { terrain, route, ...required } = design;
  const parsedTerrain = parseSavedTerrain(terrain);
  const parsedRoute = parseSavedRoute(route);

  return {
    ...(required as unknown as SavedDesign),
    ...(parsedTerrain && { terrain: parsedTerrain }),
    ...(parsedRoute && { route: parsedRoute }),
  };
}

function parseSavedTerrain(value: unknown): SavedTerrain | null {
  if (!isRecord(value)) {
    return null;
  }

  const { latitude, longitude, spanKm, elevationFloor, maxDepth, place } = value;

  if (
    !isDegrees(latitude, 90) ||
    !isDegrees(longitude, 180) ||
    !isFiniteNumber(spanKm) ||
    spanKm <= 0 ||
    !(elevationFloor === undefined || isFiniteNumber(elevationFloor)) ||
    !(maxDepth === undefined || isFiniteNumber(maxDepth)) ||
    !(place === undefined || typeof place === 'string')
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
    spanKm,
    ...(elevationFloor !== undefined && { elevationFloor }),
    ...(maxDepth !== undefined && { maxDepth }),
    ...(place !== undefined && { place }),
  };
}

function parseSavedRoute(value: unknown): SavedRoute | null {
  if (!isRecord(value) || value.version !== 1) {
    return null;
  }

  const {
    id,
    name,
    provenance,
    points: savedPoints,
    namedWaypoints,
    slopeThresholdPercent,
  } = value;

  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    (provenance !== 'drawn' && provenance !== 'imported') ||
    !Array.isArray(savedPoints) ||
    savedPoints.length > maximumRoutePoints ||
    !Array.isArray(namedWaypoints) ||
    !isFiniteNumber(slopeThresholdPercent) ||
    !validateSlopeThresholdPercent(slopeThresholdPercent).ok
  ) {
    return null;
  }

  const points: RoutePoint[] = [];

  for (const point of savedPoints) {
    if (!isRecord(point) || !isDegrees(point.latitude, 90) || !isDegrees(point.longitude, 180)) {
      return null;
    }

    if (point.elevationMeters !== undefined && !isFiniteNumber(point.elevationMeters)) {
      return null;
    }

    points.push({
      latitude: point.latitude,
      longitude: point.longitude,
      ...(point.elevationMeters !== undefined && { elevationMeters: point.elevationMeters }),
    });
  }

  const named: SavedRoute['namedWaypoints'] = [];

  for (const waypoint of namedWaypoints) {
    if (
      !isRecord(waypoint) ||
      typeof waypoint.name !== 'string' ||
      !isDegrees(waypoint.latitude, 90) ||
      !isDegrees(waypoint.longitude, 180)
    ) {
      return null;
    }

    named.push({
      name: waypoint.name,
      latitude: waypoint.latitude,
      longitude: waypoint.longitude,
    });
  }

  return {
    version: 1,
    id,
    name,
    provenance,
    points,
    namedWaypoints: named,
    slopeThresholdPercent,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isDegrees(value: unknown, limit: number): value is number {
  return isFiniteNumber(value) && Math.abs(value) <= limit;
}

function storageFailure(message: string): { ok: false; error: OperationError } {
  return {
    ok: false,
    error: { code: operationErrorCodes.storageFailed, message, retryable: true },
  };
}
