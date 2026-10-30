import type { StudioMode } from './controller';
import type { ModeFlipTimers } from './mode-flip';

/**
 * Stops 3D drawing while design-system mode covers the canvas: suspends once the canvas has faded
 * out, and resumes at once on the way back so the fade in shows a live frame. A return before the
 * fade finishes cancels the pending suspend.
 */
export function createCanvasSuspender({
  initialMode,
  fadeMs,
  timers,
  setSuspended,
}: {
  initialMode: StudioMode;
  fadeMs: number;
  timers: ModeFlipTimers;
  setSuspended: (isSuspended: boolean) => void;
}): { follow: (mode: StudioMode) => void } {
  let followedMode = initialMode;
  let pendingSuspend: number | undefined;

  return {
    follow(mode) {
      if (mode === followedMode) {
        return;
      }

      followedMode = mode;

      if (pendingSuspend !== undefined) {
        timers.clearTimeout(pendingSuspend);
        pendingSuspend = undefined;
      }

      if (mode === 'system') {
        pendingSuspend = timers.setTimeout(() => {
          pendingSuspend = undefined;
          setSuspended(true);
        }, fadeMs);
      } else {
        setSuspended(false);
      }
    },
  };
}
