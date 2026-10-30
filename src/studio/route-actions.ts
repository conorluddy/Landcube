/*
 * Route actions shared by the Route group, the command palette and the replace-confirm dialog.
 * The pending-confirmation store is module state because three unrelated surfaces start the same
 * flow and one dialog host (`RouteReplaceDialog`) answers it.
 */
import { downloadExport } from '../export/image-export';
import { getRouteGpxFilename, serializeRouteGpx } from '../gpx-export';
import { isRouteComplete } from './route-editing';
import type {
  RouteReplaceOptions,
  RouteReplaceResult,
  StudioController,
  StudioState,
} from './controller';

interface PendingReplacement {
  run: (options: RouteReplaceOptions) => RouteReplaceResult;
  /** Runs after the replacement went through, e.g. entering the Route tool. */
  onReplaced?: () => void;
}

const listeners = new Set<() => void>();
let pending: PendingReplacement | undefined;

// === PUBLIC API ===

/**
 * Runs a route replacement. A non-empty route asks first (REQ-19): the dialog's confirm calls
 * `run` again with `confirmed: true`, cancel leaves everything as it was.
 */
export function requestRouteReplacement(
  run: PendingReplacement['run'],
  onReplaced?: () => void,
): void {
  if (run({}).needsConfirmation) {
    setPending({ run, onReplaced });
  } else {
    onReplaced?.();
  }
}

export function confirmRouteReplacement(): void {
  const request = pending;

  setPending(undefined);
  request?.run({ confirmed: true });
  request?.onReplaced?.();
}

export function cancelRouteReplacement(): void {
  setPending(undefined);
}

export function hasPendingRouteReplacement(): boolean {
  return pending !== undefined;
}

export function subscribeToRouteReplacement(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/** Starts a drawn route and hands the canvas to the Route tool. */
export function drawRoute(controller: StudioController): void {
  requestRouteReplacement(
    (options) => controller.startRouteDrawing(options),
    () => {
      controller.workspace({ toolMode: 'route' });
    },
  );
}

/** Downloads the route as GPX with terrain elevations for drawn points; failures reach the status line. */
export function exportRouteGpx(controller: StudioController, state: StudioState): void {
  const { route } = state.workspace;

  if (route === null || !isRouteComplete(route.active)) {
    controller.notify('Draw at least two waypoints before exporting the route.');

    return;
  }

  const sampler = state.source.terrain?.sourceElevations;

  try {
    const xml = serializeRouteGpx(route.active, (point) => sampler?.sampleMeters(point));
    const downloaded = downloadExport({
      blob: new Blob([xml], { type: 'application/gpx+xml' }),
      filename: getRouteGpxFilename(route.active),
    });

    controller.notify(downloaded.ok ? 'GPX download started.' : downloaded.error.message);
  } catch (failure) {
    controller.notify(
      failure instanceof Error ? `GPX export failed: ${failure.message}` : 'GPX export failed.',
    );
  }
}

// === HELPERS ===

function setPending(next: PendingReplacement | undefined): void {
  pending = next;

  for (const listener of listeners) {
    listener();
  }
}
