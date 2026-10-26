export type TerrainProjection = 'perspective' | 'orthographic';
export type TerrainViewPreset = 'plan' | 'isometric' | 'oblique' | 'hero';
/** How the terrain appears to turn on screen, like a turntable seen from above. */
export type TurntableDirection = 'counterclockwise' | 'clockwise';

export interface TerrainCameraSettings {
  projection: TerrainProjection;
  focalLengthMm: number;
  /** Stops of light: each step doubles or halves the sun and fill. */
  exposureEv: number;
}

/** Session-only lens settings; 35 mm on full frame sits closest to the original 40° view. */
export const defaultTerrainCameraSettings: Readonly<TerrainCameraSettings> = Object.freeze({
  projection: 'perspective',
  focalLengthMm: 35,
  exposureEv: 0,
});

export const terrainProjections: readonly { value: TerrainProjection; label: string }[] = [
  { value: 'perspective', label: 'Perspective' },
  { value: 'orthographic', label: 'Orthographic' },
];

export const terrainFocalLengthStopsMm = [14, 24, 35, 50, 85, 135, 200, 300] as const;

/** Polar angle from straight down, azimuth clockwise from the south-facing home view. */
export const terrainViewPresets: Readonly<
  Record<
    TerrainViewPreset,
    { label: string; polarDegrees: number; azimuthDegrees: number; projection?: TerrainProjection }
  >
> = {
  plan: { label: 'Plan', polarDegrees: 0.05, azimuthDegrees: 0 },
  // True isometric: equal foreshortening on all three axes.
  isometric: {
    label: 'Isometric',
    polarDegrees: 54.74,
    azimuthDegrees: 45,
    projection: 'orthographic',
  },
  oblique: { label: 'Oblique', polarDegrees: 50, azimuthDegrees: 0 },
  hero: { label: 'Hero', polarDegrees: 78, azimuthDegrees: 30 },
};

export const turntableDirections: readonly {
  value: TurntableDirection;
  label: string;
  description: string;
}[] = [
  { value: 'counterclockwise', label: '↺', description: 'Counterclockwise' },
  { value: 'clockwise', label: '↻', description: 'Clockwise' },
];

/** The original OrbitControls default: speed 2, one revolution every 30 seconds. */
export const defaultRotationSeconds = 30;

/** Orbit distances were tuned for the original fixed 40° vertical field of view. */
export const baseTerrainFovDegrees = 40;

const fullFrameSensorHeightMm = 24;

// === PUBLIC API ===

/** Vertical field of view for a full-frame lens. */
export function getVerticalFovDegrees(focalLengthMm: number): number {
  return toDegrees(2 * Math.atan(fullFrameSensorHeightMm / 2 / focalLengthMm));
}

/** Dolly distance that keeps the target's framed size constant when the field of view changes. */
export function getCompensatedDistance(
  distance: number,
  fromFovDegrees: number,
  toFovDegrees: number,
): number {
  return (distance * getHalfFovTangent(fromFovDegrees)) / getHalfFovTangent(toFovDegrees);
}

/** Orthographic half-height that matches what a perspective camera sees at the target. */
export function getOrthographicHalfHeight(distance: number, fovDegrees: number): number {
  return distance * getHalfFovTangent(fovDegrees);
}

/** Inverse of the orthographic half-height: the perspective distance with the same framing. */
export function getDistanceForHalfHeight(halfHeight: number, fovDegrees: number): number {
  return halfHeight / getHalfFovTangent(fovDegrees);
}

/** OrbitControls auto-rotate speed; positive orbits the camera clockwise, turning the terrain counterclockwise. */
export function getAutoRotateSpeed(
  secondsPerRevolution: number,
  direction: TurntableDirection,
): number {
  const speed = 60 / secondsPerRevolution;

  return direction === 'counterclockwise' ? speed : -speed;
}

/** Values between stops show on their nearest stop. */
export function getNearestStopIndex(stops: readonly number[], value: number): number {
  return stops.reduce(
    (nearest, stop, index) =>
      Math.abs(stop - value) < Math.abs(stops[nearest] - value) ? index : nearest,
    0,
  );
}

// === HELPERS ===

function getHalfFovTangent(fovDegrees: number): number {
  return Math.tan((fovDegrees * Math.PI) / 360);
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}
