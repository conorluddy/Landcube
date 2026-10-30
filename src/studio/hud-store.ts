/**
 * Fast-changing HUD inputs that live outside the studio controller: the pointer over the viewport
 * (published from the cursor listener in `src/main.ts`) and the generated terrain's relief.
 * Kept apart so pointer moves re-render only the HUD, never the inspector.
 */
export type MapLocation =
  | { kind: 'geographic'; latitude: number; longitude: number }
  /** Generated terrain has no place on Earth: metres east and south of the north-west corner. */
  | { kind: 'local'; eastMeters: number; southMeters: number };

export type HudPointer =
  | { kind: 'away' }
  /** `xPx`/`yPx` are relative to the viewport; `location` is absent over sky or while unresolved. */
  | { kind: 'tracking'; xPx: number; yPx: number; location?: MapLocation };

export interface ElevationRangeMeters {
  minimum: number;
  maximum: number;
}

export interface HudSnapshot {
  pointer: HudPointer;
  /** Generated terrain's height field range on its nominal relief scale. */
  generatedReliefMeters?: ElevationRangeMeters;
}

/** The place under a viewport (client) point: the 2D plane, or the 3D surface by ray cast. */
export type ClientPointLocator = (clientX: number, clientY: number) => MapLocation | undefined;

/** Where a place appears over the viewport, in pixels relative to it; undefined when not drawn. */
export type LocationProjector = (location: MapLocation) => { xPx: number; yPx: number } | undefined;

export interface HudStore {
  getSnapshot: () => HudSnapshot;
  subscribe: (listener: () => void) => () => void;
  setPointer: (pointer: HudPointer) => void;
  setGeneratedRelief: (relief: ElevationRangeMeters | undefined) => void;
  /** Locates a point on demand for the measure tool; undefined until `src/main.ts` provides one. */
  locateClientPoint: ClientPointLocator;
  setLocator: (locator: ClientPointLocator) => void;
  /** Projects a place to viewport pixels on demand (2D frame or 3D camera); undefined until provided. */
  projectLocation: LocationProjector;
  setProjector: (projector: LocationProjector) => void;
  /** Bumps when the camera moves or the model rebuilds, so overlays re-project their places. */
  getProjectionRevision: () => number;
  subscribeProjection: (listener: () => void) => () => void;
  notifyProjectionChanged: () => void;
}

export const awayPointer: HudPointer = Object.freeze({ kind: 'away' });

// === PUBLIC API ===

export function createHudStore(): HudStore {
  let snapshot: HudSnapshot = { pointer: awayPointer };
  let locator: ClientPointLocator | undefined;
  let projector: LocationProjector | undefined;
  let projectionRevision = 0;
  const listeners = new Set<() => void>();
  const projectionListeners = new Set<() => void>();

  const update = (patch: Partial<HudSnapshot>) => {
    snapshot = { ...snapshot, ...patch };

    for (const listener of listeners) {
      listener();
    }
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    setPointer(pointer) {
      if (pointer.kind === 'away' && snapshot.pointer.kind === 'away') {
        return;
      }

      update({ pointer });
    },
    setGeneratedRelief(relief) {
      const current = snapshot.generatedReliefMeters;

      if (current?.minimum === relief?.minimum && current?.maximum === relief?.maximum) {
        return;
      }

      update({ generatedReliefMeters: relief });
    },
    locateClientPoint: (clientX, clientY) => locator?.(clientX, clientY),
    setLocator(nextLocator) {
      locator = nextLocator;
    },
    projectLocation: (location) => projector?.(location),
    setProjector(nextProjector) {
      projector = nextProjector;
    },
    getProjectionRevision: () => projectionRevision,
    subscribeProjection(listener) {
      projectionListeners.add(listener);

      return () => {
        projectionListeners.delete(listener);
      };
    },
    notifyProjectionChanged() {
      projectionRevision += 1;

      for (const listener of projectionListeners) {
        listener();
      }
    },
  };
}
