import { useEffect, useState } from 'react';
import {
  createRouteAnalysisCache,
  type RouteAnalyser,
  type RouteAnalysisOutcome,
} from '../route-analysis';
import type { ActiveRoute, SourceElevationSampler } from '../types/terrain-analysis';
import type { StudioState } from './controller';

// === PUBLIC API ===

/** Imported routes are analysed from every recorded point, not the simplified display copy. */
export function analyseActiveRoute(
  route: ActiveRoute,
  sampler: SourceElevationSampler | undefined,
  analyse: RouteAnalyser,
): RouteAnalysisOutcome {
  return analyse(route.originalPoints ?? route.waypoints, sampler, {
    slopeThresholdPercent: route.slopeThresholdPercent,
  });
}

/** The profile appears with a route over real terrain; procedural terrain has no analysis. */
export function hasRouteProfile(state: StudioState): boolean {
  return state.workspace.route !== null && state.source.terrain !== undefined;
}

/**
 * Terrain analysis of the active route (REQ-20-38). Recomputes once per animation frame while
 * waypoints drag, and whenever the sampler revision or threshold changes. The cache key covers
 * reversal. Undefined when there is no route.
 */
export function useRouteAnalysis(state: StudioState): RouteAnalysisOutcome | undefined {
  const active = state.workspace.route?.active;
  const sampler = state.source.terrain?.sourceElevations;
  const [analyse] = useState(createRouteAnalysisCache);
  const [outcome, setOutcome] = useState<RouteAnalysisOutcome | undefined>(() =>
    active === undefined ? undefined : analyseActiveRoute(active, sampler, analyse),
  );

  useEffect(() => {
    if (active === undefined) {
      setOutcome(undefined);

      return;
    }

    const frame = requestAnimationFrame(() => {
      setOutcome(analyseActiveRoute(active, sampler, analyse));
    });

    return () => {
      cancelAnimationFrame(frame);
    };
    // Keyed on revision, not sampler identity: equal datasets share analysis (REQ-37).
  }, [active, sampler?.revision, analyse]);

  return active === undefined ? undefined : outcome;
}
