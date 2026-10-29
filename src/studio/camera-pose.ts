import type { CameraPose } from '../terrain-camera';

/**
 * Throttles 3D camera pose updates for the HUD: whole degrees, published on change only, at most
 * once per `minimumIntervalMs`, with a trailing update so the resting pose always arrives.
 */
export interface CameraPosePublisher {
  offer: (pose: CameraPose) => void;
}

export interface PublisherClock {
  now: () => number;
  setTimeout: (callback: () => void, delayMs: number) => number;
  clearTimeout: (timer: number) => void;
}

/** Twenty updates a second keeps the compass smooth without re-rendering the studio each frame. */
export const cameraPoseMinimumIntervalMs = 50;

// === PUBLIC API ===

export function createCameraPosePublisher(
  publish: (pose: CameraPose) => void,
  clock: PublisherClock,
  minimumIntervalMs = cameraPoseMinimumIntervalMs,
): CameraPosePublisher {
  let published: CameraPose | undefined;
  let publishedAtMs = -Infinity;
  let pending: CameraPose | undefined;
  let timer: number | undefined;

  const flush = () => {
    timer = undefined;

    if (pending === undefined || isSamePose(pending, published)) {
      pending = undefined;

      return;
    }

    published = pending;
    publishedAtMs = clock.now();
    pending = undefined;
    publish(published);
  };

  return {
    offer(pose) {
      const rounded = roundCameraPose(pose);

      if (isSamePose(rounded, pending ?? published)) {
        return;
      }

      pending = rounded;

      if (timer !== undefined) {
        return;
      }

      const waitMs = publishedAtMs + minimumIntervalMs - clock.now();

      if (waitMs <= 0) {
        flush();
      } else {
        timer = clock.setTimeout(flush, waitMs);
      }
    },
  };
}

/** Whole degrees: finer changes are invisible in the readouts and the compass. */
export function roundCameraPose(pose: CameraPose): CameraPose {
  return {
    azimuthDegrees: Math.round(pose.azimuthDegrees) % 360,
    elevationDegrees: Math.round(pose.elevationDegrees),
    fovDegrees: Math.round(pose.fovDegrees),
  };
}

// === HELPERS ===

function isSamePose(first: CameraPose, second: CameraPose | undefined): boolean {
  return (
    first.azimuthDegrees === second?.azimuthDegrees &&
    first.elevationDegrees === second.elevationDegrees &&
    first.fovDegrees === second.fovDegrees
  );
}
