/*
 * Pure reducer for the one route in the session (REQ-10 to REQ-18, REQ-38). No clock, randomness
 * or terrain: ids arrive in actions so replays are deterministic. Editing an imported route's
 * geometry makes it a drawn route and drops `originalPoints`: the recorded elevations no longer
 * describe the line, and keeping them would let stale data masquerade as the route's profile.
 */
import type { ActiveRoute, GeoPoint, RouteEditing } from '../types/terrain-analysis';

export const defaultSlopeThresholdPercent = 15;
export const minimumSlopeThresholdPercent = 1;
export const maximumSlopeThresholdPercent = 100;

export interface RouteEditingState {
  route: ActiveRoute | null;
  editing: RouteEditing;
}

export type RouteEditingAction =
  | { type: 'start-drawing'; id: string; name?: string }
  | { type: 'place'; point: GeoPoint }
  | { type: 'drag'; index: number; point: GeoPoint }
  /** Inserts between waypoint `segmentIndex` and the next one. */
  | { type: 'insert'; segmentIndex: number; point: GeoPoint }
  | { type: 'select'; index: number | undefined }
  | { type: 'delete' }
  | { type: 'finish' }
  | { type: 'edit' }
  | { type: 'escape' }
  | { type: 'reverse' }
  | { type: 'clear' }
  | { type: 'set-threshold'; percent: number };

export const emptyRouteEditingState: RouteEditingState = {
  route: null,
  editing: { mode: 'viewing' },
};

// === PUBLIC API ===

/** A route needs two waypoints to have a length; shorter ones are kept but flagged (REQ-38). */
export function isRouteComplete(route: ActiveRoute): boolean {
  return route.waypoints.length >= 2;
}

export function reduceRouteEditing(
  state: RouteEditingState,
  action: RouteEditingAction,
): RouteEditingState {
  const { route, editing } = state;

  switch (action.type) {
    case 'start-drawing':
      return {
        route: {
          id: action.id,
          name: action.name ?? 'Drawn route',
          provenance: 'drawn',
          waypoints: [],
          namedWaypoints: [],
          slopeThresholdPercent: defaultSlopeThresholdPercent,
        },
        editing: { mode: 'drawing' },
      };
    case 'clear':
      return emptyRouteEditingState;
    // Finish and escape both retain the route; the controller distinguishes them for the UI.
    case 'finish':
    case 'escape':
      return route === null || editing.mode === 'viewing' ? state : { route, editing: viewing };
    case 'edit':
      return route === null || !isRouteComplete(route)
        ? state
        : { route, editing: { mode: 'editing' } };
    case 'set-threshold':
      return route === null || !Number.isFinite(action.percent)
        ? state
        : { route: { ...route, slopeThresholdPercent: clampThreshold(action.percent) }, editing };
    case 'reverse':
      return route === null
        ? state
        : {
            route: {
              ...route,
              waypoints: [...route.waypoints].reverse(),
              ...(route.originalPoints === undefined
                ? {}
                : { originalPoints: [...route.originalPoints].reverse() }),
            },
            editing: reverseSelection(editing, route.waypoints.length),
          };
    case 'place':
    case 'drag':
    case 'insert':
    case 'select':
    case 'delete':
      return route === null || editing.mode === 'viewing'
        ? state
        : reduceGeometry(route, editing, action);
  }
}

// === HELPERS ===

const viewing: RouteEditing = { mode: 'viewing' };

type GeometryAction = Extract<
  RouteEditingAction,
  { type: 'place' | 'drag' | 'insert' | 'select' | 'delete' }
>;

function reduceGeometry(
  route: ActiveRoute,
  editing: Exclude<RouteEditing, { mode: 'viewing' }>,
  action: GeometryAction,
): RouteEditingState {
  const { waypoints } = route;
  const unchanged = { route, editing };

  switch (action.type) {
    case 'select':
      return action.index !== undefined && !isIndex(waypoints, action.index)
        ? unchanged
        : {
            route,
            editing: {
              mode: editing.mode,
              ...(action.index === undefined ? {} : { selectedIndex: action.index }),
            },
          };
    case 'place':
      // Only drawing appends; editing places by insert or drag.
      return editing.mode === 'drawing'
        ? withGeometry(route, [...waypoints, action.point], editing.mode, waypoints.length)
        : unchanged;
    case 'drag':
      return isIndex(waypoints, action.index)
        ? withGeometry(
            route,
            waypoints.map((existing, index) => (index === action.index ? action.point : existing)),
            editing.mode,
            action.index,
          )
        : unchanged;
    case 'insert':
      return isIndex(waypoints, action.segmentIndex) && action.segmentIndex < waypoints.length - 1
        ? withGeometry(
            route,
            [
              ...waypoints.slice(0, action.segmentIndex + 1),
              action.point,
              ...waypoints.slice(action.segmentIndex + 1),
            ],
            editing.mode,
            action.segmentIndex + 1,
          )
        : unchanged;

    case 'delete': {
      const { selectedIndex } = editing;

      return selectedIndex === undefined || !isIndex(waypoints, selectedIndex)
        ? unchanged
        : withGeometry(
            route,
            waypoints.filter((_, index) => index !== selectedIndex),
            editing.mode,
            undefined,
          );
    }
  }
}

/** Geometry edits convert an imported route to a drawn one; see the file comment. */
function withGeometry(
  route: ActiveRoute,
  waypoints: GeoPoint[],
  mode: 'drawing' | 'editing',
  selectedIndex: number | undefined,
): RouteEditingState {
  return {
    route: {
      id: route.id,
      name: route.name,
      provenance: 'drawn',
      waypoints,
      namedWaypoints: route.namedWaypoints,
      slopeThresholdPercent: route.slopeThresholdPercent,
    },
    editing: { mode, ...(selectedIndex === undefined ? {} : { selectedIndex }) },
  };
}

function reverseSelection(editing: RouteEditing, count: number): RouteEditing {
  return editing.mode !== 'viewing' && editing.selectedIndex !== undefined
    ? { mode: editing.mode, selectedIndex: count - 1 - editing.selectedIndex }
    : editing;
}

function isIndex(list: readonly unknown[], index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < list.length;
}

function clampThreshold(percent: number): number {
  return Math.min(maximumSlopeThresholdPercent, Math.max(minimumSlopeThresholdPercent, percent));
}
