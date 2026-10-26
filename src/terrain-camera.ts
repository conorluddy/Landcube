export type TerrainProjection = 'perspective' | 'orthographic';

export interface TerrainCameraSettings {
  projection: TerrainProjection;
  focalLengthMm: number;
}

/** Session-only lens settings; 35 mm on full frame sits closest to the original 40° view. */
export const defaultTerrainCameraSettings: Readonly<TerrainCameraSettings> = Object.freeze({
  projection: 'perspective',
  focalLengthMm: 35,
});

export const terrainProjections: readonly { value: TerrainProjection; label: string }[] = [
  { value: 'perspective', label: 'Perspective' },
  { value: 'orthographic', label: 'Orthographic' },
];

export const terrainFocalLengthStopsMm = [14, 24, 35, 50, 85, 135, 200, 300] as const;

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
