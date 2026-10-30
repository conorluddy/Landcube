import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from '../ui/button';
import { CalloutLabel } from '../ui/overlays/callout-label';
import { RouteEditor, type RouteEditorPointer } from '../ui/overlays/route-editor';
import type { GeoPoint } from '../types/terrain-analysis';
import type { StudioController, StudioState } from './controller';
import type { HudStore } from './hud-store';
import { isRouteComplete } from './route-editing';
import { hasPendingRouteReplacement } from './route-actions';
import { getRouteKeyAction, getSegmentMidpoint, projectRoutePoint, toGeoPoint } from './tool-state';

/** Pointer travel below this is a tap that places a waypoint, not a drag. */
const tapSlopPx = 4;

// === PUBLIC API ===

/**
 * The Route tool (REQ-9 to REQ-19): taps place waypoints while drawing; handles drag, select and
 * delete while drawing or editing; segment targets insert. All edits go through the controller's
 * route actions. Entering with no route starts drawing; with a complete one, editing.
 *
 * Seam: `projectRoutePoint` is the only world-to-screen step. It returns undefined in 3D until
 * `terrain-3d.ts` exports a projector, so 3D shows no handles but taps still place waypoints
 * through the HUD store's ray-cast locator.
 */
export function RouteTool({
  controller: c,
  state,
  hud,
  viewportSize,
}: {
  controller: StudioController;
  state: StudioState;
  hud: HudStore;
  viewportSize: { width: number; height: number } | undefined;
}): ReactNode {
  const { route } = state.workspace;
  const editing = route?.editing ?? { mode: 'viewing' as const };
  const gesture = useRef<{ xPx: number; yPx: number; location: GeoPoint | undefined }>(undefined);
  const commitMove = useFrameThrottledMove(c);
  const view = { is3d: state.workspace.view === '3d', terrain: state.source.terrain };

  useEffect(() => {
    const { route: current } = c.getSnapshot().workspace;

    if (current === null) {
      c.startRouteDrawing();
    } else if (current.editing.mode === 'viewing') {
      c.editRoute();
    }

    // Leaving the tool stops drawing or editing; the route stays.
    return () => {
      c.escapeRoute();
    };
  }, [c]);

  useRouteKeys(c);

  const waypoints = route?.active.waypoints ?? [];
  const points = waypoints.map((waypoint) => projectRoutePoint(waypoint, view, viewportSize));
  const selectedIndex = editing.mode === 'viewing' ? undefined : editing.selectedIndex;

  if (route === null) {
    return null;
  }

  const locate = (pointer: RouteEditorPointer) =>
    toGeoPoint(hud.locateClientPoint(pointer.clientX, pointer.clientY));
  const isIncomplete = !isRouteComplete(route.active);

  return (
    <RouteEditor
      points={editing.mode === 'viewing' ? [] : points}
      selectedIndex={selectedIndex}
      isPlacing={editing.mode === 'drawing'}
      onSurfacePointer={(phase, pointer) => {
        if (phase === 'down') {
          // The surface swallows the pointerdown, so the toolbar button that started the tool would
          // otherwise keep focus and Enter would press it instead of finishing the route.
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }

          gesture.current = { xPx: pointer.xPx, yPx: pointer.yPx, location: locate(pointer) };

          return;
        }

        const start = gesture.current;

        gesture.current = undefined;

        if (
          start?.location !== undefined &&
          Math.hypot(pointer.xPx - start.xPx, pointer.yPx - start.yPx) <= tapSlopPx
        ) {
          c.placeRouteWaypoint(start.location);
        }
      }}
      onSelect={(index) => {
        if (selectedIndex !== index) {
          c.selectRouteWaypoint(index);
        }
      }}
      onMove={(index, pointer) => {
        const location = locate(pointer);

        if (location !== undefined) {
          commitMove(index, location);
        }
      }}
      onInsert={(segmentIndex) => {
        const active = c.getSnapshot().workspace.route?.active.waypoints ?? [];
        const from = active.at(segmentIndex);
        const to = active.at(segmentIndex + 1);

        if (from !== undefined && to !== undefined) {
          c.insertRouteWaypoint(segmentIndex, getSegmentMidpoint(from, to));
        }
      }}
    >
      {editing.mode !== 'viewing' && (
        <div className="lc-route-editor__bar">
          <Button
            size="small"
            onClick={() => {
              c.finishRoute();
            }}
          >
            Finish
          </Button>
          {selectedIndex !== undefined && (
            <Button
              size="small"
              onClick={() => {
                c.deleteRouteWaypoint();
              }}
            >
              Delete waypoint
            </Button>
          )}
        </div>
      )}
      {isIncomplete && viewportSize !== undefined && (
        <CalloutLabel
          anchor={{ xPx: viewportSize.width / 2, yPx: 140 }}
          value="Incomplete route"
          meta={['Add at least two waypoints']}
        />
      )}
    </RouteEditor>
  );
}

// === HELPERS ===

/** Enter finishes and Delete removes the selected waypoint; Escape is the tool shortcuts' (it must beat their exit-the-tool Escape). */
function useRouteKeys(c: StudioController): void {
  useEffect(() => {
    const pressKey = (event: KeyboardEvent) => {
      const { workspace } = c.getSnapshot();

      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        workspace.exporting ||
        workspace.palette !== null ||
        hasPendingRouteReplacement() ||
        isTextEntry(event.target) ||
        (event.key === 'Enter' && isPressableOutsideHandles(event.target))
      ) {
        return;
      }

      const action = getRouteKeyAction(event.key, workspace.route?.editing ?? { mode: 'viewing' });

      if (action === 'finish') {
        event.preventDefault();
        c.finishRoute();
      } else if (action === 'delete') {
        event.preventDefault();
        c.deleteRouteWaypoint();
      }
    };

    document.addEventListener('keydown', pressKey);

    return () => {
      document.removeEventListener('keydown', pressKey);
    };
  }, [c]);
}

/** Keeps only the latest drag position per animation frame, so a drag re-analyses at most once a frame. */
function useFrameThrottledMove(c: StudioController): (index: number, point: GeoPoint) => void {
  const pending = useRef<{ index: number; point: GeoPoint } | undefined>(undefined);
  const frame = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      if (frame.current !== undefined) {
        cancelAnimationFrame(frame.current);
      }
    },
    [],
  );

  return (index, point) => {
    pending.current = { index, point };
    frame.current ??= requestAnimationFrame(() => {
      frame.current = undefined;

      if (pending.current !== undefined) {
        c.moveRouteWaypoint(pending.current.index, pending.current.point);
        pending.current = undefined;
      }
    });
  };
}

/** Enter on a focused button activates it; finishing the route as well would be a surprise. */
function isPressableOutsideHandles(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest('button, a, [role="button"]') !== null &&
    target.closest('[data-route-handle]') === null
  );
}

function isTextEntry(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest('input, textarea, select') !== null)
  );
}
