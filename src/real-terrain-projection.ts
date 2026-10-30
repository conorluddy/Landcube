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
export function getLatitudeAtMercatorY(mercatorY: number): number {
  return (Math.atan(Math.sinh(Math.PI * (1 - 2 * mercatorY))) * 180) / Math.PI;
}

export function getLongitudeAtMercatorX(mercatorX: number): number {
  return mercatorX * 360 - 180;
}

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

/** The geographic point `RealTerrain.sample` reads at a frame point; inverse of `projectToRealTerrainFrame`. */
export function locateRealTerrainFramePoint(
  placement: RealTerrainPlacement,
  point: FramePoint,
  frame: { width: number; height: number },
): { latitude: number; longitude: number } {
  const { location, spanKm } = placement;
  const frameSize = Math.max(frame.width, frame.height);
  const spanFraction = getMercatorSpanFraction(location.latitude, spanKm);
  const longitude = getLongitudeAtMercatorX(
    getMercatorX(location.longitude) + ((point.x - frame.width / 2) / frameSize) * spanFraction,
  );

  return {
    latitude: getLatitudeAtMercatorY(
      getMercatorY(location.latitude) + ((point.y - frame.height / 2) / frameSize) * spanFraction,
    ),
    longitude: ((((longitude + 180) % 360) + 360) % 360) - 180,
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
    north: getLatitudeAtMercatorY(centerY - halfSpan),
    south: getLatitudeAtMercatorY(centerY + halfSpan),
    west: getLongitudeAtMercatorX(centerX - halfSpan),
    east: getLongitudeAtMercatorX(centerX + halfSpan),
  };
}

// === HELPERS ===

function wrapWorldOffset(offset: number): number {
  return offset - Math.round(offset);
}
