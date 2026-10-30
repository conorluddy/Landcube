/**
 * Session-only camera bookmarks for the 3D view and their eased playback tour. Pure: the
 * renderer in `src/terrain-3d.ts` drives it from an animation frame loop.
 */

export interface CameraShotVector {
  x: number;
  y: number;
  z: number;
}

/** A 3D view: the orbit target, the unit direction to the camera, and the framing distance. */
export interface CameraShot {
  target: CameraShotVector;
  direction: CameraShotVector;
  distance: number;
}

/** A shot as the studio lists it, with a small preview image. */
export interface CapturedCameraShot extends CameraShot {
  id: number;
  thumbnailUrl: string;
}

/** Why the 3D view refused a shot action; the studio turns it into a status message. */
export type CameraShotBlocker = 'not-3d' | 'walking';

export type CameraShotPlayback =
  | { kind: 'idle' }
  | { kind: 'moving'; index: number; startedAtMs: number }
  | { kind: 'holding'; index: number; startedAtMs: number };

export const cameraShotMoveMs = 2500;
export const cameraShotHoldMs = 1000;
/** A late frame starts the next phase at most this far in the past, so a paused tab resumes smoothly. */
const maxPhaseLagMs = 100;

// === PUBLIC API ===

export function easeInOutCubic(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));

  return clamped < 0.5 ? 4 * clamped ** 3 : 1 - (-2 * clamped + 2) ** 3 / 2;
}

/** Eases between two shots; the direction swings around the target rather than cutting through it. */
export function interpolateCameraShot(
  from: CameraShot,
  to: CameraShot,
  progress: number,
): CameraShot {
  const eased = easeInOutCubic(progress);

  return {
    target: lerpVector(from.target, to.target, eased),
    direction: normalizeVector(lerpVector(from.direction, to.direction, eased), to.direction),
    distance: from.distance + (to.distance - from.distance) * eased,
  };
}

/** Moves to shot `index`, holds there, then moves on; loops after the last shot. */
export function advanceCameraShotPlayback(
  playback: CameraShotPlayback,
  nowMs: number,
  shotCount: number,
  moveMs = cameraShotMoveMs,
): CameraShotPlayback {
  if (playback.kind === 'idle' || shotCount === 0) {
    return { kind: 'idle' };
  }

  const elapsedMs = nowMs - playback.startedAtMs;

  if (playback.kind === 'moving') {
    return elapsedMs < moveMs
      ? playback
      : {
          kind: 'holding',
          index: playback.index,
          startedAtMs: getNextPhaseStartMs(playback.startedAtMs + moveMs, nowMs),
        };
  }

  return elapsedMs < cameraShotHoldMs
    ? playback
    : {
        kind: 'moving',
        index: (playback.index + 1) % shotCount,
        startedAtMs: getNextPhaseStartMs(playback.startedAtMs + cameraShotHoldMs, nowMs),
      };
}

// === HELPERS ===

function getNextPhaseStartMs(phaseEndMs: number, nowMs: number): number {
  return Math.max(phaseEndMs, nowMs - maxPhaseLagMs);
}

function lerpVector(
  from: CameraShotVector,
  to: CameraShotVector,
  amount: number,
): CameraShotVector {
  return {
    x: from.x + (to.x - from.x) * amount,
    y: from.y + (to.y - from.y) * amount,
    z: from.z + (to.z - from.z) * amount,
  };
}

/** Opposite directions lerp through zero; the destination stands in for the undefined midpoint. */
function normalizeVector(vector: CameraShotVector, fallback: CameraShotVector): CameraShotVector {
  const length = Math.hypot(vector.x, vector.y, vector.z);

  return length < 1e-6
    ? fallback
    : { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}
