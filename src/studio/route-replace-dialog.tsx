import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { Button } from '../ui/button';
import { GlassPanel } from '../ui/glass-panel';
import {
  cancelRouteReplacement,
  confirmRouteReplacement,
  hasPendingRouteReplacement,
  subscribeToRouteReplacement,
} from './route-actions';

/** "Replace the current route?" (REQ-19): shown when Draw or a GPX load would discard a route. */
export function RouteReplaceDialog(): ReactNode {
  const isOpen = useSyncExternalStore(subscribeToRouteReplacement, hasPendingRouteReplacement);
  const cancelButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    cancelButton.current?.focus();

    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelRouteReplacement();
      }
    };

    document.addEventListener('keydown', cancelOnEscape);

    return () => {
      document.removeEventListener('keydown', cancelOnEscape);
    };
  }, [isOpen]);

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
            <Button ref={cancelButton} onClick={cancelRouteReplacement}>
              Cancel
            </Button>
            <Button variant="primary" onClick={confirmRouteReplacement}>
              Replace route
            </Button>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
