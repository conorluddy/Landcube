import {
  seaLevelHatchWidth,
  seaLevelHatchSpacing,
  seaLevelHatchOpacity,
} from './constants/sea-level';
import type { RealTerrain } from './real-terrain';
import type { ContourPoint } from './types/contours';
import type { HeightField } from './types/terrain';

export interface SeaLevelGeometry {
  elevation: number;
  polygons: ContourPoint[][];
}

interface ElevationPoint extends ContourPoint {
  elevation: number;
}

/** Clips sampled terrain triangles at true sea level, including regions touching the frame. */
export function createSeaLevelGeometry(
  field: HeightField,
  width: number,
  height: number,
  terrain?: RealTerrain,
): SeaLevelGeometry | undefined {
  if (terrain?.seaLevelHatching !== true || terrain.seaLevel === undefined) {
    return undefined;
  }

  const level = terrain.seaLevel;
  const polygons: ContourPoint[][] = [];
  const point = (column: number, row: number): ElevationPoint => ({
    x: field.originX + column * field.spacing,
    y: field.originY + row * field.spacing,
    elevation: field.values[row * field.columns + column],
  });

  for (let row = 0; row < field.rows - 1; row++) {
    let runStart: number | undefined;
    let runEnd = 0;
    const top = Math.max(0, field.originY + row * field.spacing);
    const bottom = Math.min(height, field.originY + (row + 1) * field.spacing);

    const flushRun = () => {
      if (runStart !== undefined) {
        polygons.push([
          { x: runStart, y: top },
          { x: runEnd, y: top },
          { x: runEnd, y: bottom },
          { x: runStart, y: bottom },
        ]);
        runStart = undefined;
      }
    };

    if (bottom <= top) {
      continue;
    }

    for (let column = 0; column < field.columns - 1; column++) {
      const a = point(column, row);
      const b = point(column + 1, row);
      const c = point(column + 1, row + 1);
      const d = point(column, row + 1);

      if (c.x <= 0 || a.x >= width) {
        continue;
      }

      // Merge fully submerged cells into row spans to keep large SVG exports compact.
      if ([a, b, c, d].every((vertex) => vertex.elevation <= level)) {
        runStart ??= Math.max(0, a.x);
        runEnd = Math.min(width, b.x);
        continue;
      }

      flushRun();

      if ([a, b, c, d].every((vertex) => vertex.elevation > level)) {
        continue;
      }

      for (const triangle of [
        [a, b, c],
        [a, c, d],
      ]) {
        let polygon = clipPolygon(triangle, (vertex) => level - vertex.elevation);

        for (const distance of [
          (vertex: ElevationPoint) => vertex.x,
          (vertex: ElevationPoint) => width - vertex.x,
          (vertex: ElevationPoint) => vertex.y,
          (vertex: ElevationPoint) => height - vertex.y,
        ]) {
          polygon = clipPolygon(polygon, distance);
        }

        if (polygon.length >= 3) {
          polygons.push(polygon);
        }
      }
    }

    flushRun();
  }

  return { elevation: level, polygons };
}

/** Sutherland–Hodgman clipping retains partial coastal triangles without filling land. */
function clipPolygon(
  polygon: ElevationPoint[],
  distance: (point: ElevationPoint) => number,
): ElevationPoint[] {
  const result: ElevationPoint[] = [];

  for (let index = 0; index < polygon.length; index++) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];
    const da = distance(a);
    const db = distance(b);

    if (da >= 0) {
      result.push(a);
    }

    if (da >= 0 !== db >= 0) {
      const fraction = da / (da - db);

      result.push({
        x: a.x + (b.x - a.x) * fraction,
        y: a.y + (b.y - a.y) * fraction,
        elevation: a.elevation + (b.elevation - a.elevation) * fraction,
      });
    }
  }

  return result;
}

/** Uses one global pattern so hatching continues seamlessly between clipped polygons. */
export function createSeaLevelMarkup(
  geometry: SeaLevelGeometry | undefined,
  color: string,
): string {
  if (geometry === undefined || geometry.polygons.length === 0) {
    return '';
  }

  const path = geometry.polygons
    .map(
      (polygon) =>
        polygon
          .map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
          .join('') + 'Z',
    )
    .join('');

  return `<defs><pattern id="sea-level-hatching" patternUnits="userSpaceOnUse" width="${seaLevelHatchSpacing}" height="${seaLevelHatchSpacing}" patternTransform="rotate(45)"><path d="M${seaLevelHatchSpacing / 2} 0V${seaLevelHatchSpacing}" fill="none" stroke="${color}" stroke-width="${seaLevelHatchWidth}" stroke-opacity="${seaLevelHatchOpacity}"/></pattern></defs><path data-sea-level="0" d="${path}" fill="url(#sea-level-hatching)"/>`;
}
