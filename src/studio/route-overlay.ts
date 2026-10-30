/*
 * Route helpers shared by the 2D overlay and the Overlays popover: projecting a GPX route into
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
import type { ActiveRoute } from '../types/terrain-analysis';

export interface ProjectedRoute {
  points: FramePoint[];
  waypoints: (FramePoint & { name: string })[];
}

// === PUBLIC API ===

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
export function describeRoute(route: WorkspaceRoute): string {
  const { stats, active } = route;
  const waypoints = active.namedWaypoints;

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
