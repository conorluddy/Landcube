import type { TerrainSurfaceBuffers } from '../terrain-surface';
import type { FrameFootprint, FrameProfilePoint } from '../types/frame';
import { createOutlineRing } from './frame-outline';

/**
 * Sweeps an open counter-clockwise profile around the footprint. Each point becomes one ring,
 * neighbouring rings join as quad strips, and fans to the centre close both ends. No CSG.
 */
export function sweepFrameProfile(
  footprint: FrameFootprint,
  points: readonly FrameProfilePoint[],
): TerrainSurfaceBuffers {
  if (points.length < 2) {
    throw new Error(`A frame profile needs at least 2 points; got ${points.length}.`);
  }

  // Repeated points would sweep into zero-area triangles that fail as a misleading STL error.
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1];

    if (
      points[index].offsetMm === previous.offsetMm &&
      points[index].heightMm === previous.heightMm
    ) {
      throw new Error(
        `Frame profile points ${index - 1} and ${index} repeat (${previous.offsetMm}, ${previous.heightMm}). Remove the duplicate point.`,
      );
    }
  }

  const positions: number[] = [];
  let ringSize = 0;

  for (const point of points) {
    const ring = createOutlineRing(footprint, point.offsetMm);

    ringSize = ring.length;

    for (const { x, z } of ring) {
      positions.push(x, point.heightMm, z);
    }
  }

  const indices: number[] = [];

  for (let ring = 0; ring < points.length - 1; ring++) {
    for (let segment = 0; segment < ringSize; segment++) {
      const a = ring * ringSize + segment;
      const b = ring * ringSize + ((segment + 1) % ringSize);

      indices.push(a, a + ringSize, b + ringSize, a, b + ringSize, b);
    }
  }

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const startCentre = positions.length / 3;
  const endCentre = startCentre + 1;
  const endRing = (points.length - 1) * ringSize;

  positions.push(0, firstPoint.heightMm, 0, 0, lastPoint.heightMm, 0);

  for (let segment = 0; segment < ringSize; segment++) {
    const next = (segment + 1) % ringSize;

    indices.push(startCentre, segment, next);
    indices.push(endCentre, endRing + next, endRing + segment);
  }

  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}
