import type { ReactNode } from 'react';
import { RouteProfile } from '../ui/overlays/route-profile';
import type { StudioController, StudioState } from './controller';
import { describeRouteSummary } from './route-overlay';
import { hasRouteProfile, useRouteAnalysis } from './use-route-analysis';

/**
 * Connects the route profile to the controller: analysis in, inspection and threshold out.
 * Collapsing only hides the panel; the route stays (REQ-23), so the collapsed flag lives with
 * the caller, which also sizes the HUD around it.
 */
export function RouteProfileHost({
  controller,
  state,
  isCollapsed,
  onCollapsedChange,
}: {
  controller: StudioController;
  state: StudioState;
  isCollapsed: boolean;
  onCollapsedChange: (isCollapsed: boolean) => void;
}): ReactNode {
  const outcome = useRouteAnalysis(state);
  const route = state.workspace.route;

  if (route === null || !hasRouteProfile(state)) {
    return null;
  }

  const { analysis } = outcome?.kind === 'analysed' ? outcome : { analysis: undefined };

  return (
    <RouteProfile
      summary={describeRouteSummary(outcome, route.active.provenance)}
      profile={
        analysis === undefined
          ? undefined
          : {
              groundMeters: analysis.groundMeters,
              samples: analysis.samples,
              steepSections: analysis.steepSections,
            }
      }
      slopeThresholdPercent={route.active.slopeThresholdPercent}
      inspectedDistanceMeters={route.inspectedDistanceMeters}
      isCollapsed={isCollapsed}
      onCollapsedChange={onCollapsedChange}
      onInspect={(distanceMeters) => {
        controller.inspectRoute(distanceMeters);
      }}
      onThresholdChange={(percent) => {
        controller.setRouteSlopeThreshold(percent);
      }}
    />
  );
}
