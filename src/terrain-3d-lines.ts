import { clipCircleSegment, type TerrainCropShape } from './terrain-crop';
import { getContourStyle, type ContourStyle } from './contour-style';
import { clipTerrainSegment, terrain3dElevationScale } from './terrain-surface';
import type { Contour } from './types/contours';
import type { DesignSettings } from './types/design';

export interface TerrainLineBuffers {
  positions: number[];
  distanceStarts: number[];
  distanceEnds: number[];
}

/** Retains each path's dash phase through clipped edges and resets it for disconnected paths. */
export function createTerrainLineBuffers(
  contours: Contour[],
  width: number,
  height: number,
  settings: Readonly<DesignSettings>,
  shape: TerrainCropShape = 'rectangle',
): Record<ContourStyle, TerrainLineBuffers> {
  const groups: Record<ContourStyle, TerrainLineBuffers> = {
    ordinary: { positions: [], distanceStarts: [], distanceEnds: [] },
    solid: { positions: [], distanceStarts: [], distanceEnds: [] },
    dashed: { positions: [], distanceStarts: [], distanceEnds: [] },
  };
  const interval = contours.length > 1 ? contours[1].elevation - contours[0].elevation : 1;
  const scale = 2 / Math.max(width, height);

  for (const contour of contours) {
    const group =
      groups[
        getContourStyle(
          contour.elevationMeters ?? contour.elevation,
          contour.intervalMeters ?? interval,
          settings,
        )
      ];

    for (const path of contour.paths) {
      let distance = 0;
      const count = path.points.length;

      for (let index = 0; index < count - (path.closed ? 0 : 1); index++) {
        const a = path.points[index];
        const b = path.points[(index + 1) % count];
        const segment =
          shape === 'circle'
            ? clipCircleSegment(a, b, width)
            : clipTerrainSegment(a, b, width, height);

        if (segment) {
          group.distanceStarts.push(distance + Math.hypot(segment[0].x - a.x, segment[0].y - a.y));
          group.distanceEnds.push(distance + Math.hypot(segment[1].x - a.x, segment[1].y - a.y));

          for (const point of segment) {
            group.positions.push(
              (point.x - width / 2) * scale,
              contour.elevation * terrain3dElevationScale + 0.0008,
              (point.y - height / 2) * scale,
            );
          }
        }

        distance += Math.hypot(b.x - a.x, b.y - a.y);
      }
    }
  }

  return groups;
}
