import { createRouteAnalysisCache, type RouteAnalysisOutcome } from '../route-analysis';
import type { ActiveRoute, SourceElevationSampler } from '../types/terrain-analysis';
import type { StudioState } from './controller';

// One memo for every reader (profile, route group), so a state change analyses the route once.
// Waypoint drags already arrive at most once per animation frame (`route-tool.tsx`).
const analyseRoute = createRouteAnalysisCache();

// === PUBLIC API ===

/**
 * Terrain analysis of a route (REQ-20-38). Imported routes are analysed from every recorded point,
 * not the simplified display copy. The memo keys on geometry, sampler revision and threshold, so
 * reversal and a new terrain dataset (REQ-30, REQ-37) recompute and nothing else does.
 */
export function analyseActiveRoute(
  route: ActiveRoute,
  sampler: SourceElevationSampler | undefined,
): RouteAnalysisOutcome {
  return analyseRoute(route.originalPoints ?? route.waypoints, sampler, {
    slopeThresholdPercent: route.slopeThresholdPercent,
  });
}

/** The profile appears with a route over real terrain; procedural terrain has no analysis. */
export function hasRouteProfile(state: StudioState): boolean {
  return state.workspace.route !== null && state.source.terrain !== undefined;
}

/** The active route's analysis; undefined when there is no route. */
export function getActiveRouteAnalysis(state: StudioState): RouteAnalysisOutcome | undefined {
  const active = state.workspace.route?.active;

  return active === undefined
    ? undefined
    : analyseActiveRoute(active, state.source.terrain?.sourceElevations);
}
