/**
 * Keeping the sliotar balanced on a flat bas: the ball lags the hurl's motion, and the carrier
 * tilts the bas under it so gravity rolls it back to the middle. Visual only; it never falls off.
 * Axes are the view's: x to the right, z towards the player. Lengths are in eye heights.
 */
export interface BalanceState {
  offsetX: number;
  offsetZ: number;
  velocityX: number;
  velocityZ: number;
}

export interface BalanceTilt {
  /** The bas face's downhill slope (rise over run) towards +x and +z. */
  slopeX: number;
  slopeZ: number;
}

export const centredBalance: BalanceState = { offsetX: 0, offsetZ: 0, velocityX: 0, velocityZ: 0 };

/** How far the ball can drift from the sweet spot before the bas's edge stops it. */
export const maxBalanceOffsetEyeHeights = 0.06;

/** Advances the ball by one frame, given the bas's acceleration in view axes. */
export function stepBalance(
  state: BalanceState,
  basAccelerationX: number,
  basAccelerationZ: number,
  gravityEyeHeightsPerSecondSquared: number,
  seconds: number,
): { state: BalanceState; tilt: BalanceTilt } {
  const tilt = getBalancingTilt(state, gravityEyeHeightsPerSecondSquared);
  // A rolling solid ball takes 5/7 of the downhill pull; the rest goes into spin.
  const roll = (5 / 7) * gravityEyeHeightsPerSecondSquared;
  const accelerationX =
    -inertiaShare * basAccelerationX + roll * tilt.slopeX - frictionPerSecond * state.velocityX;
  const accelerationZ =
    -inertiaShare * basAccelerationZ + roll * tilt.slopeZ - frictionPerSecond * state.velocityZ;
  const next = {
    velocityX: state.velocityX + accelerationX * seconds,
    velocityZ: state.velocityZ + accelerationZ * seconds,
    offsetX: state.offsetX,
    offsetZ: state.offsetZ,
  };

  next.offsetX += next.velocityX * seconds;
  next.offsetZ += next.velocityZ * seconds;

  return { state: keepOnBas(next), tilt };
}

/** The carrier's lean: downhill towards the middle, harder the further and faster the ball drifts. */
export function getBalancingTilt(
  state: BalanceState,
  gravityEyeHeightsPerSecondSquared: number,
): BalanceTilt {
  const roll = (5 / 7) * gravityEyeHeightsPerSecondSquared;
  // Gains for a recentring spring of this frequency and damping, given the downhill pull.
  const offsetGain = recentreRadiansPerSecond ** 2 / roll;
  const velocityGain = (2 * recentreDampingRatio * recentreRadiansPerSecond) / roll;
  const slopeX = -(offsetGain * state.offsetX + velocityGain * state.velocityX);
  const slopeZ = -(offsetGain * state.offsetZ + velocityGain * state.velocityZ);
  const slope = Math.hypot(slopeX, slopeZ);
  const limit = slope > maxSlope ? maxSlope / slope : 1;

  return { slopeX: slopeX * limit, slopeZ: slopeZ * limit };
}

// === HELPERS ===

/** Felt share of the hurl's acceleration; the full jolt of a mouse flick would pin the ball to the rim. */
const inertiaShare = 0.15;
const frictionPerSecond = 1.5;
const recentreRadiansPerSecond = 8;
/** Under 1, so the ball overshoots the middle once before it settles: the wobble. */
const recentreDampingRatio = 0.45;
/** About 15°: past that, the lean stops looking like effortless balance. */
const maxSlope = Math.tan((15 * Math.PI) / 180);

/** The rim stops the ball: clamp it inside and drop any velocity still heading outwards. */
function keepOnBas(state: BalanceState): BalanceState {
  const distance = Math.hypot(state.offsetX, state.offsetZ);

  if (distance <= maxBalanceOffsetEyeHeights) {
    return state;
  }

  const outwardX = state.offsetX / distance;
  const outwardZ = state.offsetZ / distance;
  const outwardSpeed = Math.max(state.velocityX * outwardX + state.velocityZ * outwardZ, 0);

  return {
    offsetX: outwardX * maxBalanceOffsetEyeHeights,
    offsetZ: outwardZ * maxBalanceOffsetEyeHeights,
    velocityX: state.velocityX - outwardSpeed * outwardX,
    velocityZ: state.velocityZ - outwardSpeed * outwardZ,
  };
}
