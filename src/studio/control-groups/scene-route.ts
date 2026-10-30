/*
 * Route group (SCEN.12): a GPX track or route drawn over real terrain, in 2D and draped in 3D.
 * Session-only; never in design links or the STL. Built only when real terrain is loaded.
 */
import { createElement } from 'react';
import { getFault } from '../../constants/faults';
import { operationErrorCodes } from '../../constants/operations';
import type { ControlGroupDefinition } from '../../ui/control-rows';
import type { RealTerrain } from '../../real-terrain';
import type { StudioController, StudioState } from '../controller';
import { buttonRow, customRow, hintRow, statusRow, toggleRow } from '../control-rows';
import { RouteFileField } from '../route-file-field';
import { countRoutePointsInside, describeRoute } from '../route-overlay';

// === PUBLIC API ===

export function buildRouteGroup(
  controller: StudioController,
  state: StudioState,
  terrain: RealTerrain,
): ControlGroupDefinition {
  const { route, routeFault } = state.workspace;
  const insideCount =
    route === null ? undefined : countRoutePointsInside(route.active.waypoints, terrain);

  return {
    id: 'route',
    title: 'Route',
    rows: [
      customRow('route-file', () => createElement(RouteFileField, { controller })),
      routeFault !== null &&
        statusRow('route-fault', {
          kind: 'fault',
          code: getFault(operationErrorCodes.invalidRoute).code,
          isAlert: true,
          children: routeFault.message,
        }),
      toggleRow('route-visible', {
        label: 'Show route',
        value: route?.isVisible ?? false,
        disabled: route === null,
        onChange: () => {
          controller.toggleRoute();
        },
      }),
      route !== null && hintRow('route-stats', describeRoute(route)),
      route !== null &&
        insideCount !== undefined &&
        hintRow(
          'route-clip',
          `${insideCount} of ${route.active.waypoints.length} points inside the loaded area.`,
        ),
      buttonRow('route-clear', {
        children: 'Clear route',
        disabled: route === null,
        onClick: () => {
          controller.clearRoute();
        },
      }),
      hintRow(
        'route-hint',
        'Load a GPX track or route to draw it over the terrain. Session-only; omitted from STL and design links.',
      ),
    ],
  };
}
