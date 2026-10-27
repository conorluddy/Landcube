import {
  roadClassWidthFactors,
  roadDetailClasses,
  roadWidthMmLimits,
  roadWidthMmPerModelKm,
} from './constants/roads';
import { projectToRealTerrainFrame, type FramePoint } from './real-terrain-projection';
import type { RealTerrain } from './real-terrain';
import { clipCircleSegment, type TerrainCropShape } from './terrain-crop';
import { clipTerrainSegment, sampleHeightField, terrain3dElevationScale } from './terrain-surface';
import type { HeightField } from './types/terrain';
import type { MappedRoad, RoadPath, RoadStyle } from './types/roads';

export interface RoadRibbonBuffers {
  positions: Float32Array;
  indices: Uint32Array;
}

/** The model crop within the real-terrain source frame, as `cropTerrainModelField` returns it. */
interface SourceCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Shared so updates without roads keep one identity and never rebuild empty geometry. */
export const noRoadPaths: readonly RoadPath[] = Object.freeze([]);

/** Miters longer than this many half-widths are clamped, so sharp bends cannot spike. */
const maximumMiterScale = 2;

/** Projects mapped roads into crop units and splits them wherever they leave the model. */
export function clipRoadsToCrop(
  roads: readonly MappedRoad[],
  placement: Required<Pick<RealTerrain, 'location' | 'spanKm'>>,
  sourceFrame: { width: number; height: number },
  crop: SourceCrop,
  shape: TerrainCropShape,
): RoadPath[] {
  const paths: RoadPath[] = [];

  for (const road of roads) {
    const points = road.points.map(({ latitude, longitude }) => {
      const point = projectToRealTerrainFrame(placement, latitude, longitude, sourceFrame);

      return { x: point.x - crop.x, y: point.y - crop.y };
    });

    for (const run of clipPolyline(points, crop.width, crop.height, shape)) {
      paths.push({ roadClass: road.roadClass, points: run });
    }
  }

  return paths;
}

/**
 * Drapes flat road ribbons over the height field in 3D preview units, before exaggeration.
 * Both edges sample the terrain, so a road on a side slope tilts with it instead of floating.
 */
export function createRoadRibbonBuffers(
  paths: readonly RoadPath[],
  field: HeightField,
  width: number,
  height: number,
  style: Pick<RoadStyle, 'detail' | 'widthMm'>,
  frameUnitsPerMm: number,
  shape: TerrainCropShape,
): RoadRibbonBuffers {
  const classes: readonly string[] = roadDetailClasses[style.detail];
  const positions: number[] = [];
  const indices: number[] = [];
  const scale = 2 / Math.max(width, height);
  const clamp = createFootprintClamp(width, height, shape);

  for (const path of paths) {
    if (!classes.includes(path.roadClass)) {
      continue;
    }

    const halfWidth = (style.widthMm * roadClassWidthFactors[path.roadClass] * frameUnitsPerMm) / 2;
    const points = densifyPolyline(path.points, field.spacing);

    if (points.length < 2) {
      continue;
    }

    const first = positions.length / 3;

    for (let index = 0; index < points.length; index++) {
      const offset = getMiterOffset(points, index, halfWidth);

      for (const side of [1, -1]) {
        const edge = clamp({
          x: points[index].x + offset.x * side,
          y: points[index].y + offset.y * side,
        });

        positions.push(
          (edge.x - width / 2) * scale,
          sampleHeightField(field, edge.x, edge.y) * terrain3dElevationScale,
          (edge.y - height / 2) * scale,
        );
      }
    }

    // Each point adds a left then a right vertex; this winding keeps ribbon faces upward.
    for (let index = 0; index < points.length - 1; index++) {
      const left = first + index * 2;
      const right = left + 1;

      indices.push(left, left + 2, right, right, left + 2, right + 2);
    }
  }

  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}

/** Secondary-road width for a model covering `modelSpanKm` on its longer side, on the slider's steps. */
export function getSuggestedRoadWidthMm(modelSpanKm: number): number {
  const { minimum, maximum, step } = roadWidthMmLimits;
  const widthMm = Math.round((modelSpanKm * roadWidthMmPerModelKm) / step) * step;

  return Number(Math.min(maximum, Math.max(minimum, widthMm)).toFixed(2));
}

// === HELPERS ===

/** Consecutive segments that stay inside the footprint share one run; leaving it ends the run. */
function clipPolyline(
  points: readonly FramePoint[],
  width: number,
  height: number,
  shape: TerrainCropShape,
): FramePoint[][] {
  const runs: FramePoint[][] = [];
  let current: FramePoint[] | undefined;

  for (let index = 0; index < points.length - 1; index++) {
    const a = points[index];
    const b = points[index + 1];

    if (a.x === b.x && a.y === b.y) {
      continue;
    }

    const segment =
      shape === 'circle' ? clipCircleSegment(a, b, width) : clipTerrainSegment(a, b, width, height);

    if (!segment) {
      current = undefined;
      continue;
    }

    const [start, end] = segment;

    // Clipping returns the original endpoint exactly when it is inside the footprint.
    if (!current || start.x !== a.x || start.y !== a.y) {
      current = [start];
      runs.push(current);
    }

    current.push(end);

    if (end.x !== b.x || end.y !== b.y) {
      current = undefined;
    }
  }

  return runs;
}

/** Splits long segments so the ribbon follows the terrain between mapped points. */
function densifyPolyline(points: readonly FramePoint[], stepUnits: number): FramePoint[] {
  const dense: FramePoint[] = [points[0]];

  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1];
    const b = points[index];
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / stepUnits);

    for (let step = 1; step <= steps; step++) {
      dense.push({ x: a.x + ((b.x - a.x) * step) / steps, y: a.y + ((b.y - a.y) * step) / steps });
    }
  }

  return dense;
}

/** Left-hand offset at a point, mitered between its neighbouring segments. */
function getMiterOffset(
  points: readonly FramePoint[],
  index: number,
  halfWidth: number,
): FramePoint {
  const previous = getSegmentNormal(points[Math.max(0, index - 1)], points[Math.max(1, index)]);
  const next = getSegmentNormal(
    points[Math.min(points.length - 2, index)],
    points[Math.min(points.length - 1, index + 1)],
  );
  const sum = { x: previous.x + next.x, y: previous.y + next.y };
  const length = Math.hypot(sum.x, sum.y);

  // A full reversal has no miter direction; the previous normal keeps the ribbon closed.
  if (length < 1e-9) {
    return { x: previous.x * halfWidth, y: previous.y * halfWidth };
  }

  const miter = { x: sum.x / length, y: sum.y / length };
  const scale = Math.min(maximumMiterScale, 1 / (miter.x * previous.x + miter.y * previous.y));

  return { x: miter.x * halfWidth * scale, y: miter.y * halfWidth * scale };
}

function getSegmentNormal(a: FramePoint, b: FramePoint): FramePoint {
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;

  return { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
}

/** Keeps ribbon edges on the model so roads at the crop edge never overhang the base. */
function createFootprintClamp(
  width: number,
  height: number,
  shape: TerrainCropShape,
): (point: FramePoint) => FramePoint {
  if (shape === 'circle') {
    const radius = width / 2;

    return (point) => {
      const distance = Math.hypot(point.x - radius, point.y - radius);

      return distance <= radius
        ? point
        : {
            x: radius + ((point.x - radius) * radius) / distance,
            y: radius + ((point.y - radius) * radius) / distance,
          };
    };
  }

  return (point) => ({
    x: Math.max(0, Math.min(width, point.x)),
    y: Math.max(0, Math.min(height, point.y)),
  });
}
