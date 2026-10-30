import type { StudioMode } from './controller';

// === TYPES ===

/** How the inspector's rotation animates: ease-in on the way out, `--lc-ease` on the way in, or not at all. */
export type FlipTransition = 'none' | 'foldOut' | 'foldIn';

export interface ModeFlipSnapshot {
  /** Which mode's chrome is on screen. Lags the committed mode until the panel is edge-on. */
  shownMode: StudioMode;
  angleDegrees: number;
  transition: FlipTransition;
  /** Toggles are ignored while true. */
  isBusy: boolean;
  /** Bumped once per animated flip, so the scan line can restart by key. */
  sweepCount: number;
}

export interface ModeFlipTimers {
  setTimeout: (callback: () => void, delayMs: number) => number;
  clearTimeout: (handle: number) => void;
}

export interface ModeFlip {
  getSnapshot: () => ModeFlipSnapshot;
  subscribe: (listener: () => void) => () => void;
  /**
   * Starts a flip to `mode`, committing it before animating; true when it started. A request made
   * mid-flip is held and runs as the flip finishes, so an early Esc is never dropped.
   */
  request: (mode: StudioMode) => boolean;
  /** Follows a mode change made elsewhere (a phone viewport, a deep link) without animating. */
  snapTo: (mode: StudioMode) => void;
  dispose: () => void;
}

/** Timer-driven, never rAF: rAF stalls in background tabs and would leave the panel edge-on. */
export const modeFlipTiming = {
  foldOutMs: 260,
  settleMs: 30,
  foldInMs: 300,
  /** Unlocks even if a fold-in timer never fired; normally the lock clears when the fold-in ends. */
  safetyMs: 700,
  /** Terrain and ground cross-fade; terrain drawing pauses once it has faded out. */
  canvasFadeMs: 600,
} as const;

// === PUBLIC API ===

/**
 * Flips the inspector between studio and system chrome: fold to 90°, swap the contents edge-on,
 * snap to −90°, then fold back to 0°. Reduced motion swaps at once and leaves only the cross-fade.
 */
export function createModeFlip({
  initialMode,
  commit,
  prefersReducedMotion,
  timers,
}: {
  initialMode: StudioMode;
  commit: (mode: StudioMode) => void;
  prefersReducedMotion: () => boolean;
  timers: ModeFlipTimers;
}): ModeFlip {
  let snapshot: ModeFlipSnapshot = {
    shownMode: initialMode,
    angleDegrees: 0,
    transition: 'none',
    isBusy: false,
    sweepCount: 0,
  };
  const listeners = new Set<() => void>();
  const pendingTimers = new Set<number>();
  let heldMode: StudioMode | undefined;

  const update = (patch: Partial<ModeFlipSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => {
      listener();
    });
  };

  const after = (delayMs: number, callback: () => void) => {
    const handle = timers.setTimeout(() => {
      pendingTimers.delete(handle);
      callback();
    }, delayMs);

    pendingTimers.add(handle);
  };

  const unlock = () => {
    if (!snapshot.isBusy) {
      return;
    }

    update({ angleDegrees: 0, transition: 'none', isBusy: false });

    const next = heldMode;

    heldMode = undefined;

    if (next !== undefined) {
      request(next);
    }
  };

  const clearPending = () => {
    pendingTimers.forEach((handle) => {
      timers.clearTimeout(handle);
    });
    pendingTimers.clear();
  };

  function request(mode: StudioMode): boolean {
    if (snapshot.isBusy) {
      heldMode = mode;

      return false;
    }

    if (mode === snapshot.shownMode) {
      return false;
    }

    // A finished flip's safety timer must not land on this one.
    clearPending();
    commit(mode);

    if (prefersReducedMotion()) {
      update({ shownMode: mode });

      return true;
    }

    update({
      angleDegrees: 90,
      transition: 'foldOut',
      isBusy: true,
      sweepCount: snapshot.sweepCount + 1,
    });
    after(modeFlipTiming.foldOutMs, () => {
      update({ shownMode: mode, angleDegrees: -90, transition: 'none' });
      after(modeFlipTiming.settleMs, () => {
        update({ angleDegrees: 0, transition: 'foldIn' });
        after(modeFlipTiming.foldInMs, unlock);
      });
    });
    after(modeFlipTiming.safetyMs, unlock);

    return true;
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    request,
    snapTo(mode) {
      if (mode === snapshot.shownMode && !snapshot.isBusy) {
        return;
      }

      clearPending();
      heldMode = undefined;
      update({ shownMode: mode, angleDegrees: 0, transition: 'none', isBusy: false });
    },
    dispose: clearPending,
  };
}
