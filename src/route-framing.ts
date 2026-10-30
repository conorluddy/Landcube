/*
 * Where to load terrain so a route sits in the middle of it: the centre of the route's extent and
 * the smallest span stop that holds it with a margin. Platform-free; used to offer "Centre terrain
 * on route" after a GPX loads somewhere off-centre.
 */
import { realTerrainBounds, realTerrainSpanStopsKm } from './constants/real-terrain';
import { measureGroundMeters } from './route-sampling';
import type { GeoPoint } from './types/terrain-analysis';

export interface RouteFraming {
  latitude: number;
  longitude: number;
  spanKm: number;
}

/** Room around the route's extent, so its ends do not sit on the model edge. */
const framingMargin = 1.2;
/** A route centre further than this fraction of the span from the terrain centre is off-centre. */
const offCentreSpanFraction = 0.2;

// === PUBLIC API ===

/** Undefined for fewer than two points. Routes wider than the largest span get the largest span. */
export function frameRoute(points: readonly GeoPoint[]): RouteFraming | undefined {
  if (points.length < 2) {
    return undefined;
  }

  const latitudes = points.map(({ latitude }) => latitude);
  const longitudes = points.map(({ longitude }) => longitude);
  const south = Math.min(...latitudes);
  const north = Math.max(...latitudes);
  const west = Math.min(...longitudes);
  const east = Math.max(...longitudes);
  const latitude = clamp(
    (south + north) / 2,
    realTerrainBounds.minimumLatitude,
    realTerrainBounds.maximumLatitude,
  );
  const longitude = (west + east) / 2;
  const extentKm =
    Math.max(
      measureGroundMeters({ latitude: south, longitude }, { latitude: north, longitude }),
      measureGroundMeters({ latitude, longitude: west }, { latitude, longitude: east }),
    ) / 1000;
  const spanKm =
    realTerrainSpanStopsKm.find((stop) => stop >= extentKm * framingMargin) ??
    realTerrainBounds.maximumSpanKm;

  // Five decimals (about a metre) keep the coordinate fields readable.
  return { latitude: roundTo5(latitude), longitude: roundTo5(longitude), spanKm };
}

/**
 * True when the loaded terrain already frames the route: every point inside the patch and the
 * route's centre near the patch centre. False means the offer to re-centre is worth showing.
 */
export function isRouteFramed(
  points: readonly GeoPoint[],
  terrain: { location: GeoPoint; spanKm: number },
  insidePointCount: number,
): boolean {
  const framing = frameRoute(points);

  if (framing === undefined) {
    return true;
  }

  const offsetKm = measureGroundMeters(terrain.location, framing) / 1000;

  return insidePointCount === points.length && offsetKm <= terrain.spanKm * offCentreSpanFraction;
}

// === HELPERS ===

function roundTo5(degrees: number): number {
  return Math.round(degrees * 1e5) / 1e5;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
