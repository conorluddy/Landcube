import { generatedTerrainSpanMeters } from '../constants/grass';
import type { GeoBounds } from '../floor-geo';
import type { RealTerrain } from '../real-terrain';
import { locateRealTerrainFramePoint, type FramePoint } from '../real-terrain-projection';
import type { MapLocation } from './hud-store';

/**
 * Maps viewport and 3D model positions to the place they show, for the HUD coordinate tip.
 * Real terrain resolves to latitude/longitude; generated terrain to metres on its nominal 10 km
 * square (the same scale grass uses), measured from the frame's north-west corner.
 */
type TerrainPlacement = Pick<RealTerrain, 'location' | 'spanKm'>;
interface FrameSize {
  width: number;
  height: number;
}
interface FrameCrop extends FrameSize {
  x: number;
  y: number;
}

export type ModelPlacement =
  | { kind: 'geographic'; bounds: GeoBounds }
  | { kind: 'generated'; crop: FrameCrop; frame: FrameSize };

// === PUBLIC API ===

/** The place under a 2D viewport point; the 2D frame is the viewport. */
export function locateViewportPoint(
  point: FramePoint,
  frame: FrameSize,
  terrain: TerrainPlacement | undefined,
): MapLocation {
  const location = terrain?.location;
  const spanKm = terrain?.spanKm;

  if (location !== undefined && spanKm !== undefined) {
    return {
      kind: 'geographic',
      ...locateRealTerrainFramePoint({ location, spanKm }, point, frame),
    };
  }

  const metersPerPixel = getFrameMetersPerPixel(frame, undefined);

  return {
    kind: 'local',
    eastMeters: point.x * metersPerPixel,
    southMeters: point.y * metersPerPixel,
  };
}

/** The place at a fraction across the 3D model (0,0 = north-west corner). */
export function locateModelFraction(fraction: FramePoint, model: ModelPlacement): MapLocation {
  if (model.kind === 'geographic') {
    const { north, south, west, east } = model.bounds;

    return {
      kind: 'geographic',
      latitude: north + (south - north) * fraction.y,
      longitude: west + (east - west) * fraction.x,
    };
  }

  const { crop, frame } = model;
  const metersPerUnit = getFrameMetersPerPixel(frame, undefined);

  return {
    kind: 'local',
    eastMeters: (crop.x + crop.width * fraction.x) * metersPerUnit,
    southMeters: (crop.y + crop.height * fraction.y) * metersPerUnit,
  };
}

/** Ground metres per frame unit: the square source span covers the frame's longer side. */
export function getFrameMetersPerPixel(
  frame: FrameSize,
  terrain: TerrainPlacement | undefined,
): number {
  const spanMeters =
    terrain?.spanKm === undefined ? generatedTerrainSpanMeters : terrain.spanKm * 1000;

  return spanMeters / Math.max(1, frame.width, frame.height);
}
