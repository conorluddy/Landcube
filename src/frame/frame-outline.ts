import { terrainCircleSegments } from '../terrain-crop';
import type { TerrainModelSettings } from '../terrain-model';
import type { FrameFootprint } from '../types/frame';

export interface OutlinePoint {
  x: number;
  z: number;
}

/**
 * Offsets the footprint outward by `offsetMm`. Rings run from +X toward +Z, like the circular
 * terrain surface, and every ring of one footprint has the same vertex count.
 */
export function createOutlineRing(footprint: FrameFootprint, offsetMm: number): OutlinePoint[] {
  const halfExtentMm = getOutlineHalfExtentMm(footprint, offsetMm);

  if (!(halfExtentMm > 0)) {
    throw new Error(
      `Frame ring at offset ${offsetMm} mm has half-extent ${halfExtentMm} mm. Validate frame settings before sweeping.`,
    );
  }

  if (footprint.shape === 'circle') {
    const radiusMm = footprint.radiusMm + offsetMm;

    return Array.from({ length: terrainCircleSegments }, (_, segment) => {
      const angle = (segment / terrainCircleSegments) * Math.PI * 2;

      return { x: Math.cos(angle) * radiusMm, z: Math.sin(angle) * radiusMm };
    });
  }

  // Offsetting each side by the same distance keeps the corners mitred.
  const x = footprint.halfWidthMm + offsetMm;
  const z = footprint.halfLengthMm + offsetMm;

  return [
    { x, z },
    { x: -x, z },
    { x: -x, z: -z },
    { x, z: -z },
  ];
}

/** The smaller half-extent of the offset outline; at or below zero the ring collapses. */
export function getOutlineHalfExtentMm(footprint: FrameFootprint, offsetMm: number): number {
  return footprint.shape === 'circle'
    ? footprint.radiusMm + offsetMm
    : Math.min(footprint.halfWidthMm, footprint.halfLengthMm) + offsetMm;
}

/** Matches the model: a `widthMm` disc for circle crops, otherwise `widthMm × lengthMm`. */
export function getFrameFootprint(model: TerrainModelSettings): FrameFootprint {
  return model.cropShape === 'circle'
    ? { shape: 'circle', radiusMm: model.widthMm / 2 }
    : { shape: 'rectangle', halfWidthMm: model.widthMm / 2, halfLengthMm: model.lengthMm / 2 };
}
