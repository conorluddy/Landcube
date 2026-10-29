import type { GeoBounds } from './floor-geo';
import type { RealTerrain } from './real-terrain';

/** A point in the frame `RealTerrain.sample` reads, in the same units as its `x` and `y`. */
export interface FramePoint {
  x: number;
  y: number;
}

type RealTerrainPlacement = Required<Pick<RealTerrain, 'location' | 'spanKm'>>;

const earthCircumferenceMeters = 40075016.686;

/** Web Mercator x in world units, 0 at 180°W and 1 at 180°E. */
export function getMercatorX(longitude: number): number {
  return (longitude + 180) / 360;
}

/** Web Mercator y in world units, 0 at the northern tile edge and 1 at the southern one. */
export function getMercatorY(latitude: number): number {
  return (1 - Math.asinh(Math.tan((latitude * Math.PI) / 180)) / Math.PI) / 2;
}

/** The square source span as a fraction of the Mercator world width. */
export function getMercatorSpanFraction(latitude: number, spanKm: number): number {
  return (spanKm * 1000) / (earthCircumferenceMeters * Math.cos((latitude * Math.PI) / 180));
}

/** Places a geographic point where `RealTerrain.sample` reads its elevation for the same frame. */
export function projectToRealTerrainFrame(
  placement: RealTerrainPlacement,
  latitude: number,
  longitude: number,
  frame: { width: number; height: number },
): FramePoint {
  const { location, spanKm } = placement;
  const frameSize = Math.max(frame.width, frame.height);
  const spanFraction = getMercatorSpanFraction(location.latitude, spanKm);
  // A source that straddles the antimeridian keeps points on its own side of the date line.
  const eastFraction = wrapWorldOffset(getMercatorX(longitude) - getMercatorX(location.longitude));
  const southFraction = getMercatorY(latitude) - getMercatorY(location.latitude);

  return {
    x: frame.width / 2 + (eastFraction / spanFraction) * frameSize,
    y: frame.height / 2 + (southFraction / spanFraction) * frameSize,
  };
}

/**
 * Geographic edges of the square source patch, so a feature query covers every possible crop.
 * Near the antimeridian `west` or `east` runs past ±180°; queries split such a patch in two.
 */
export function getRealTerrainSourceBounds(placement: RealTerrainPlacement): GeoBounds {
  const { location, spanKm } = placement;
  const halfSpan = getMercatorSpanFraction(location.latitude, spanKm) / 2;
  const centerX = getMercatorX(location.longitude);
  const centerY = getMercatorY(location.latitude);

  return {
    north: getMercatorLatitude(centerY - halfSpan),
    south: getMercatorLatitude(centerY + halfSpan),
    west: getMercatorLongitude(centerX - halfSpan),
    east: getMercatorLongitude(centerX + halfSpan),
  };
}

/** Inverse of `getMercatorY`. */
export function getMercatorLatitude(mercatorY: number): number {
  return (Math.atan(Math.sinh(Math.PI * (1 - 2 * mercatorY))) * 180) / Math.PI;
}

/** Inverse of `getMercatorX`; values past the world edge run beyond ±180°. */
export function getMercatorLongitude(mercatorX: number): number {
  return mercatorX * 360 - 180;
}

function wrapWorldOffset(offset: number): number {
  return offset - Math.round(offset);
}
