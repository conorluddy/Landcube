import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from '../ui/button';
import { GlassPanel } from '../ui/glass-panel';
import type { StudioController, StudioState } from './controller';

/** "Replace the current route?" (REQ-19): shown when Draw or a GPX load would discard a route. */
export function RouteReplaceDialog({
  controller,
  state,
}: {
  controller: StudioController;
  state: StudioState;
}): ReactNode {
  const isOpen = state.workspace.routeReplacement !== null;
  const cancelButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    cancelButton.current?.focus();

    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        controller.cancelRouteReplacement();
      }
    };

    document.addEventListener('keydown', cancelOnEscape);

    return () => {
      document.removeEventListener('keydown', cancelOnEscape);
    };
  }, [controller, isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="lc-route-confirm">
      <div role="alertdialog" aria-modal="true" aria-label="Replace the current route?">
        <GlassPanel className="lc-route-confirm__card">
          <strong>Replace the current route?</strong>
          <span>The route on the map and any edits to it will be lost.</span>
          <div className="lc-route-confirm__actions">
            <Button ref={cancelButton} onClick={controller.cancelRouteReplacement}>
              Cancel
            </Button>
            <Button variant="primary" onClick={controller.confirmRouteReplacement}>
              Replace route
            </Button>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
