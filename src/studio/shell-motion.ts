/**
 * Flags `.studio-shell[data-motion="active"]` while the 3D view moves, so glass trades its
 * backdrop blur for opaque alpha (see `src/ui/base.css`). Drags and wheel pulses clear 200ms
 * after the last movement; turntable rotation and terrain morphs hold the flag until they end.
 */
export interface ShellMotion {
  /** A momentary movement such as an orbit drag step; clears after the idle delay. */
  pulse: () => void;
  /** Long-running motion; the flag clears after the idle delay once nothing is held. */
  setHeld: (reason: MotionHoldReason, isHeld: boolean) => void;
  /** Follows orbit drags, wheel zoom and morphs on the WebGL canvas. */
  watchCanvas: (canvas: HTMLCanvasElement) => void;
}

export type MotionHoldReason = 'turntable' | 'morph';

const motionIdleDelayMs = 200;

// === PUBLIC API ===

export function createShellMotion(findShell: () => Element | null): ShellMotion {
  const heldReasons = new Set<MotionHoldReason>();
  let idleTimer: number | undefined;

  const settle = () => {
    if (heldReasons.size === 0) {
      findShell()?.removeAttribute('data-motion');
    }
  };

  const pulse = () => {
    findShell()?.setAttribute('data-motion', 'active');
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(settle, motionIdleDelayMs);
  };

  const setHeld = (reason: MotionHoldReason, isHeld: boolean) => {
    if (isHeld) {
      heldReasons.add(reason);
    } else if (!heldReasons.delete(reason)) {
      return;
    }

    pulse();
  };

  return {
    pulse,
    setHeld,
    watchCanvas(canvas) {
      canvas.addEventListener(
        'pointermove',
        (event) => {
          if (event.buttons !== 0) {
            pulse();
          }
        },
        { passive: true },
      );
      canvas.addEventListener('wheel', pulse, { passive: true });
      new MutationObserver(() => {
        setHeld('morph', canvas.dataset.terrainTransition === 'morphing');
      }).observe(canvas, { attributes: true, attributeFilter: ['data-terrain-transition'] });
    },
  };
}
