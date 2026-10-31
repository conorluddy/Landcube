import * as THREE from 'three';
import { isSoundMuted } from './sound-preference';
import type { WalkScale } from './terrain-walk';
import { createThrowableModels, type ThrowableModels } from './terrain-throwables-models';

/** Spike: walk-only toys. A hurl strikes a sliotar across the terrain; a boomerang loops back. */
export type Throwable = 'sliotar' | 'boomerang';

type GroundHeight = (x: number, z: number) => number | undefined;

/** One projectile's motion. Vectors are mutated in place each step. */
export type Projectile =
  | { kind: 'flying'; item: Throwable; position: THREE.Vector3; velocity: THREE.Vector3 }
  | { kind: 'rolling'; item: Throwable; position: THREE.Vector3; velocity: THREE.Vector3 }
  | {
      kind: 'returning';
      item: 'boomerang';
      position: THREE.Vector3;
      origin: THREE.Vector3;
      forward: THREE.Vector3;
      left: THREE.Vector3;
      reach: number;
      elapsedSeconds: number;
    }
  | { kind: 'resting'; item: Throwable; position: THREE.Vector3 };

export interface TerrainThrowables {
  readonly heldItem: Throwable;
  /** Sizes everything for this walk's map. */
  start(scale: WalkScale): void;
  charge(): void;
  release(): void;
  /** Swaps hurl and boomerang, recalling anything thrown. */
  toggle(): void;
  recall(): void;
  step(elapsedSeconds: number): void;
  stop(): void;
  dispose(): void;
}

interface TerrainThrowablesOptions {
  scene: THREE.Scene;
  camera: THREE.Camera;
  getGroundHeight: GroundHeight;
}

// Sizes are in eye heights, so the toys feel the same on any map.
export const sliotarRadiusEyeHeights = 0.06;
const sliotarSpeedEyeHeights = { min: 8, max: 30 };
const strikeLoftRadians = 0.25;
const restitution = 0.5;
const tangentialFriction = 0.8;
/** Below this bounce speed (eye heights per second) the ball settles into a roll. */
const rollSpeedEyeHeights = 0.6;
const rollDragPerSecond = 0.6;
const restSpeedEyeHeights = 0.05;
const restSlope = 0.02;
const slopeSampleEyeHeights = 0.1;

export const boomerangDurationSeconds = 2.5;
const boomerangReachEyeHeights = { min: 6, max: 20 };
const boomerangLiftEyeHeights = 1.5;
const fullChargeSeconds = 1;
/** A gentle toss from the off hand: it peaks this far above the hand. */
const tossPeakEyeHeights = 1.2;

/** How near the bas the falling ball must be when the swing is released to connect. */
export const strikeZoneEyeHeights = 0.6;
const swingSeconds = 0.3;

// Reused every step so throwing doesn't churn the garbage collector.
const scratchNormal = new THREE.Vector3();
const scratchDirection = new THREE.Vector3();

// === PUBLIC API ===

export function launchSliotar(
  origin: THREE.Vector3,
  viewDirection: THREE.Vector3,
  charge: number,
  scale: WalkScale,
): Projectile {
  const speed =
    THREE.MathUtils.lerp(sliotarSpeedEyeHeights.min, sliotarSpeedEyeHeights.max, charge) *
    scale.eyeHeight;
  const direction = viewDirection.clone().normalize();
  const pitch = Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1)) + strikeLoftRadians;
  const heading = direction.setY(0).normalize();
  const velocity = heading
    .multiplyScalar(Math.cos(pitch))
    .setY(Math.sin(pitch))
    .multiplyScalar(speed);

  return { kind: 'flying', item: 'sliotar', position: origin.clone(), velocity };
}

/** The first stage of a strike: the sliotar goes straight up out of the off hand. */
export function launchToss(origin: THREE.Vector3, scale: WalkScale): Projectile {
  const speed = Math.sqrt(2 * scale.gravityPerSecondSquared * tossPeakEyeHeights * scale.eyeHeight);

  return {
    kind: 'flying',
    item: 'sliotar',
    position: origin.clone(),
    velocity: new THREE.Vector3(0, speed, 0),
  };
}

/** True when a swing released now meets the ball; anything else is a whiff. */
export function isInStrikeZone(
  ballPosition: THREE.Vector3,
  basPosition: THREE.Vector3,
  scale: WalkScale,
): boolean {
  return ballPosition.distanceTo(basPosition) <= strikeZoneEyeHeights * scale.eyeHeight;
}

export function launchBoomerang(
  origin: THREE.Vector3,
  viewDirection: THREE.Vector3,
  charge: number,
  scale: WalkScale,
): Projectile {
  const forward = viewDirection.clone().setY(0).normalize();

  return {
    kind: 'returning',
    item: 'boomerang',
    position: origin.clone(),
    origin: origin.clone(),
    forward,
    left: new THREE.Vector3(forward.z, 0, -forward.x),
    reach:
      THREE.MathUtils.lerp(boomerangReachEyeHeights.min, boomerangReachEyeHeights.max, charge) *
      scale.eyeHeight,
    elapsedSeconds: 0,
  };
}

/**
 * Advances a projectile; undefined when it's back in hand (caught near `catcher`, or lost off the
 * model's edge).
 */
export function stepProjectile(
  projectile: Projectile,
  elapsedSeconds: number,
  getGroundHeight: GroundHeight,
  scale: WalkScale,
  catcher: THREE.Vector3,
): Projectile | undefined {
  switch (projectile.kind) {
    case 'flying':
      return stepFlying(projectile, elapsedSeconds, getGroundHeight, scale);
    case 'rolling':
      return stepRolling(projectile, elapsedSeconds, getGroundHeight, scale);
    case 'returning':
      return stepReturning(projectile, elapsedSeconds, getGroundHeight, scale, catcher);
    case 'resting':
      return getGroundHeight(projectile.position.x, projectile.position.z) === undefined
        ? undefined
        : projectile;
  }
}

export function createTerrainThrowables(options: TerrainThrowablesOptions): TerrainThrowables {
  const { scene, camera, getGroundHeight } = options;
  let models: ThrowableModels | undefined;
  let scale: WalkScale | undefined;
  let heldItem: Throwable = 'sliotar';
  let projectile: Projectile | undefined;
  let chargeStartedAtMs: number | undefined;
  let swingSecondsLeft = 0;
  /** A tossed sliotar still in the air, waiting for the swing. */
  let isTossed = false;

  const recall = () => {
    projectile = undefined;
    isTossed = false;
    models?.setProjectile(undefined, heldItem);
  };

  const release = () => {
    if (chargeStartedAtMs === undefined || !scale || !models) {
      return;
    }

    const charge = readCharge(chargeStartedAtMs);

    chargeStartedAtMs = undefined;

    if (heldItem === 'boomerang') {
      const origin = models.getHandPosition(new THREE.Vector3());

      projectile = launchBoomerang(
        origin,
        camera.getWorldDirection(scratchDirection),
        charge,
        scale,
      );
      swingSecondsLeft = swingSeconds;
    } else if (!isTossed) {
      projectile = launchToss(models.getSliotarPosition(new THREE.Vector3()), scale);
      isTossed = true;
    } else {
      // A swing always plays; only a well-timed one meets the ball.
      swingSecondsLeft = swingSeconds;
      const bas = models.getBasPosition(new THREE.Vector3());

      if (projectile && isInStrikeZone(projectile.position, bas, scale)) {
        const viewDirection = camera.getWorldDirection(scratchDirection);

        projectile = launchSliotar(projectile.position, viewDirection, charge, scale);
        isTossed = false;
        playHurlSlap(charge);
      }
    }

    models.setProjectile(projectile, heldItem);
  };

  return {
    get heldItem() {
      return heldItem;
    },
    start(walkScale) {
      scale = walkScale;
      models ??= createThrowableModels();
      models.setScale(walkScale.eyeHeight);
      scene.add(models.viewmodel, models.projectileMesh);
      recall();
    },
    charge() {
      // With a ball in the air this charges the swing; otherwise it recalls the last one, like E.
      if (!isTossed) {
        recall();
      }

      chargeStartedAtMs = performance.now();
    },
    release,
    toggle() {
      heldItem = heldItem === 'sliotar' ? 'boomerang' : 'sliotar';
      chargeStartedAtMs = undefined;
      recall();
    },
    recall,
    step(elapsedSeconds) {
      if (!models || !scale) {
        return;
      }

      if (projectile) {
        projectile = stepProjectile(
          projectile,
          elapsedSeconds,
          getGroundHeight,
          scale,
          camera.position,
        );
        // Once a tossed ball drops past the bas it's a whiff; it falls, and the next click picks it up.
        const basHeight = models.getBasPosition(scratchDirection).y;

        isTossed &&=
          projectile !== undefined &&
          projectile.position.y > basHeight - strikeZoneEyeHeights * scale.eyeHeight;
        models.setProjectile(projectile, heldItem);
      }

      swingSecondsLeft = Math.max(swingSecondsLeft - elapsedSeconds, 0);
      models.updateViewmodel(camera, {
        heldItem,
        isThrown: projectile !== undefined,
        charge: chargeStartedAtMs === undefined ? 0 : readCharge(chargeStartedAtMs),
        swing: 1 - swingSecondsLeft / swingSeconds,
        elapsedSeconds,
      });
    },
    stop() {
      projectile = undefined;
      isTossed = false;
      chargeStartedAtMs = undefined;
      swingSecondsLeft = 0;

      if (models) {
        scene.remove(models.viewmodel, models.projectileMesh);
      }
    },
    dispose() {
      this.stop();
      models?.dispose();
      models = undefined;
    },
  };
}

// === HELPERS ===

let hurlSlap: HTMLAudioElement | undefined;

/** The ash-on-leather crack of a strike; harder strikes ring louder. */
function playHurlSlap(charge: number) {
  if (isSoundMuted()) {
    return;
  }

  hurlSlap ??= new Audio(`${import.meta.env.BASE_URL}audio/hurl-slap.mp3`);
  hurlSlap.currentTime = 0;
  hurlSlap.volume = THREE.MathUtils.lerp(0.4, 1, charge);
  // Autoplay refusals are harmless: the strike still flies.
  hurlSlap.play().catch(() => undefined);
}

function readCharge(chargeStartedAtMs: number) {
  return THREE.MathUtils.clamp(
    (performance.now() - chargeStartedAtMs) / 1000 / fullChargeSeconds,
    0,
    1,
  );
}

function stepFlying(
  projectile: Extract<Projectile, { kind: 'flying' }>,
  elapsedSeconds: number,
  getGroundHeight: GroundHeight,
  scale: WalkScale,
): Projectile | undefined {
  const { position, velocity } = projectile;

  velocity.y -= scale.gravityPerSecondSquared * elapsedSeconds;
  position.addScaledVector(velocity, elapsedSeconds);

  const ground = getGroundHeight(position.x, position.z);
  const radius = sliotarRadiusEyeHeights * scale.eyeHeight;

  if (ground === undefined) {
    return undefined;
  }

  if (position.y - radius > ground) {
    return projectile;
  }

  const normal = sampleGroundNormal(position, getGroundHeight, scale, scratchNormal);
  const normalSpeed = velocity.dot(normal);

  position.y = ground + radius;

  if (normalSpeed < 0) {
    velocity.addScaledVector(normal, -normalSpeed);
    velocity.multiplyScalar(tangentialFriction);
    velocity.addScaledVector(normal, -normalSpeed * restitution);
  }

  return Math.abs(normalSpeed) * restitution < rollSpeedEyeHeights * scale.eyeHeight
    ? { kind: 'rolling', item: projectile.item, position, velocity: velocity.setY(0) }
    : projectile;
}

function stepRolling(
  projectile: Extract<Projectile, { kind: 'rolling' }>,
  elapsedSeconds: number,
  getGroundHeight: GroundHeight,
  scale: WalkScale,
): Projectile | undefined {
  const { position, velocity } = projectile;
  const normal = sampleGroundNormal(position, getGroundHeight, scale, scratchNormal);

  if (normal.lengthSq() === 0) {
    return undefined;
  }

  // Gravity's pull along the surface, projected onto the ground plane.
  velocity.x += scale.gravityPerSecondSquared * normal.x * normal.y * elapsedSeconds;
  velocity.z += scale.gravityPerSecondSquared * normal.z * normal.y * elapsedSeconds;
  velocity.multiplyScalar(Math.exp(-rollDragPerSecond * elapsedSeconds));
  position.x += velocity.x * elapsedSeconds;
  position.z += velocity.z * elapsedSeconds;

  const ground = getGroundHeight(position.x, position.z);

  if (ground === undefined) {
    return undefined;
  }

  position.y = ground + sliotarRadiusEyeHeights * scale.eyeHeight;
  const slope = Math.hypot(normal.x, normal.z) / normal.y;
  const isSettled = velocity.length() < restSpeedEyeHeights * scale.eyeHeight && slope < restSlope;

  return isSettled ? { kind: 'resting', item: projectile.item, position } : projectile;
}

function stepReturning(
  projectile: Extract<Projectile, { kind: 'returning' }>,
  elapsedSeconds: number,
  getGroundHeight: GroundHeight,
  scale: WalkScale,
  catcher: THREE.Vector3,
): Projectile | undefined {
  projectile.elapsedSeconds = Math.min(
    projectile.elapsedSeconds + elapsedSeconds,
    boomerangDurationSeconds,
  );

  const previous = projectile.position.clone();
  const angle = (2 * Math.PI * projectile.elapsedSeconds) / boomerangDurationSeconds;
  const { position, origin, forward, left, reach } = projectile;

  // An ellipse through the origin: out along the throw, banking left, home again.
  position
    .copy(origin)
    .addScaledVector(forward, (reach * (1 - Math.cos(angle))) / 2)
    .addScaledVector(left, (reach / 3) * Math.sin(angle));
  position.y += boomerangLiftEyeHeights * scale.eyeHeight * Math.sin(angle / 2);

  const ground = getGroundHeight(position.x, position.z);

  if (ground === undefined) {
    return undefined;
  }

  if (position.y <= ground) {
    position.y = ground;

    return { kind: 'resting', item: 'boomerang', position };
  }

  if (projectile.elapsedSeconds < boomerangDurationSeconds) {
    return projectile;
  }

  if (position.distanceTo(catcher) <= scale.eyeHeight) {
    return undefined;
  }

  // The walker moved away: it drops where it arrives, carrying its last heading.
  const velocity = position.clone().sub(previous).divideScalar(Math.max(elapsedSeconds, 1e-3));

  return { kind: 'flying', item: 'boomerang', position, velocity };
}

/** Upward unit normal from central differences; zero length where the ground can't be sampled. */
function sampleGroundNormal(
  position: THREE.Vector3,
  getGroundHeight: GroundHeight,
  scale: WalkScale,
  target: THREE.Vector3,
) {
  const epsilon = slopeSampleEyeHeights * scale.eyeHeight;
  const east = getGroundHeight(position.x + epsilon, position.z);
  const west = getGroundHeight(position.x - epsilon, position.z);
  const south = getGroundHeight(position.x, position.z + epsilon);
  const north = getGroundHeight(position.x, position.z - epsilon);

  if (east === undefined || west === undefined || south === undefined || north === undefined) {
    return target.set(0, 0, 0);
  }

  return target
    .set(-(east - west) / (2 * epsilon), 1, -(south - north) / (2 * epsilon))
    .normalize();
}
