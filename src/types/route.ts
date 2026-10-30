/** A GPX trackpoint or routepoint. Elevation is as recorded by the device, not from terrain. */
export interface RoutePoint {
  latitude: number;
  longitude: number;
  elevationMeters?: number;
}

export interface RouteWaypoint {
  name: string;
  latitude: number;
  longitude: number;
}

/** A parsed GPX file: every track segment and route joined into one line. */
export interface GpxRoute {
  name?: string;
  points: RoutePoint[];
  waypoints: RouteWaypoint[];
}

export interface RouteStats {
  distanceKm: number;
  /** Absent unless at least two points carry an elevation. */
  ascentMeters?: number;
  descentMeters?: number;
  /** Points in the file, before simplification. */
  recordedPointCount: number;
}
