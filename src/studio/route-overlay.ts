/*
 * Route helpers shared by the 2D overlay and the Route section: projecting a GPX route into
 * the viewport frame, counting what lies inside the loaded area, and the one-line summary.
 */
import type { GeoBounds } from '../floor-geo';
import type { RealTerrain } from '../real-terrain';
import {
  getRealTerrainSourceBounds,
  projectToRealTerrainFrame,
  type FramePoint,
} from '../real-terrain-projection';
import type { WorkspaceRoute } from './controller';
import type { RouteAnalysisOutcome } from '../route-analysis';
import type { ActiveRoute, RouteProvenance } from '../types/terrain-analysis';

export interface ProjectedRoute {
  points: FramePoint[];
  waypoints: (FramePoint & { name: string })[];
}

/** Display-ready route totals (REQ-20-22, 32, 33, 38); absent fields are not shown. */
export interface RouteSummary {
  /** 'incomplete' is a route still being drawn: no profile, no totals. */
  status: 'incomplete' | 'ready';
  ground?: string;
  /** Terrain-following length; only when every sample has coverage. */
  surface?: string;
  ascent?: string;
  descent?: string;
  /** Signed, e.g. "+20 m". */
  net?: string;
  /** Totals exclude spans without elevation coverage. */
  isPartial: boolean;
  /** Imported routes report terrain figures, never the file's recorded ones. */
  isTerrainDerived: boolean;
}

// === PUBLIC API ===

export function formatRouteDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

export function formatRouteElevation(meters: number, isSigned = false): string {
  const rounded = Math.round(meters);
  const sign = rounded > 0 ? (isSigned ? '+' : '') : rounded < 0 ? '-' : '';

  return `${sign}${Math.abs(rounded)} m`;
}

export function describeRouteSummary(
  outcome: RouteAnalysisOutcome | undefined,
  provenance: RouteProvenance,
): RouteSummary {
  const isTerrainDerived = provenance === 'imported';

  if (outcome === undefined || outcome.kind === 'incomplete') {
    return { status: 'incomplete', isPartial: false, isTerrainDerived };
  }

  const { groundMeters, surfaceMeters, ascentMeters, descentMeters, netMeters, isPartial } =
    outcome.analysis;

  return {
    status: 'ready',
    ground: formatRouteDistance(groundMeters),
    surface:
      !isPartial && surfaceMeters !== undefined ? formatRouteDistance(surfaceMeters) : undefined,
    ascent: ascentMeters === undefined ? undefined : formatRouteElevation(ascentMeters),
    descent: descentMeters === undefined ? undefined : formatRouteElevation(descentMeters),
    net: netMeters === undefined ? undefined : formatRouteElevation(netMeters, true),
    // Without any covered sample there are no totals to qualify; the chart says "No elevation data".
    isPartial: isPartial && ascentMeters !== undefined,
    isTerrainDerived,
  };
}

/** "11.1 km ground · 11.3 km surface · ascent 130 m · descent 90 m · net +40 m" */
export function listRouteSummaryParts(summary: RouteSummary): string[] {
  if (summary.status === 'incomplete') {
    return ['Incomplete route'];
  }

  const parts = [`${summary.ground} ground`];

  if (summary.surface !== undefined) {
    parts.push(`${summary.surface} surface`);
  }

  if (summary.ascent !== undefined) {
    parts.push(`ascent ${summary.ascent}`, `descent ${summary.descent}`, `net ${summary.net}`);
  }

  if (summary.isPartial) {
    parts.push('Partial');
  }

  if (summary.isTerrainDerived) {
    parts.push('Terrain-derived');
  }

  return parts;
}

/** Places the route where the 2D terrain draws the same latitude and longitude. */
export function projectRouteToFrame(
  route: Pick<ActiveRoute, 'waypoints' | 'namedWaypoints'>,
  terrain: Pick<RealTerrain, 'location' | 'spanKm'>,
  frame: { width: number; height: number },
): ProjectedRoute | undefined {
  const { location, spanKm } = terrain;

  if (location === undefined || spanKm === undefined) {
    return undefined;
  }

  const placement = { location, spanKm };

  return {
    points: route.waypoints.map((point) =>
      projectToRealTerrainFrame(placement, point.latitude, point.longitude, frame),
    ),
    waypoints: route.namedWaypoints.map((waypoint) => ({
      name: waypoint.name,
      ...projectToRealTerrainFrame(placement, waypoint.latitude, waypoint.longitude, frame),
    })),
  };
}

/** Route points inside the loaded source patch; the rest are clipped from both views. */
export function countRoutePointsInside(
  points: readonly { latitude: number; longitude: number }[],
  terrain: Pick<RealTerrain, 'location' | 'spanKm'>,
): number | undefined {
  const { location, spanKm } = terrain;

  if (location === undefined || spanKm === undefined) {
    return undefined;
  }

  const bounds = getRealTerrainSourceBounds({ location, spanKm });

  return points.filter((point) => isInsideBounds(point, bounds)).length;
}

/** "Ridge walk · 6.2 km · ascent 130 m · descent 90 m · 2 waypoints" */
export function describeRoute(route: WorkspaceRoute, outcome?: RouteAnalysisOutcome): string {
  const { stats, active } = route;
  const waypoints = active.namedWaypoints;

  if (outcome !== undefined) {
    const summary = describeRouteSummary(outcome, active.provenance);
    const parts = [active.name, ...listRouteSummaryParts(summary)];

    if (waypoints.length > 0) {
      parts.push(`${waypoints.length} ${waypoints.length === 1 ? 'waypoint' : 'waypoints'}`);
    }

    return parts.join(' · ');
  }

  // Drawn routes have no recorded stats; terrain analysis reports their length elsewhere.
  if (stats === undefined) {
    return `${active.name} · ${active.waypoints.length} points`;
  }

  const parts = [active.name, `${stats.distanceKm.toFixed(1)} km`];

  if (stats.ascentMeters !== undefined && stats.descentMeters !== undefined) {
    parts.push(
      `ascent ${Math.round(stats.ascentMeters)} m`,
      `descent ${Math.round(stats.descentMeters)} m`,
    );
  }

  parts.push(`${waypoints.length} ${waypoints.length === 1 ? 'waypoint' : 'waypoints'}`);

  return parts.join(' · ');
}

// === HELPERS ===

function isInsideBounds(
  point: { latitude: number; longitude: number },
  { north, south, west, east }: GeoBounds,
): boolean {
  const isWithinLatitude = point.latitude <= north && point.latitude >= south;
  // A patch across the antimeridian reports west beyond east.
  const isWithinLongitude =
    west <= east
      ? point.longitude >= west && point.longitude <= east
      : point.longitude >= west || point.longitude <= east;

  return isWithinLatitude && isWithinLongitude;
}
