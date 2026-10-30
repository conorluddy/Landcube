/*
 * The displayed 3D surface (smooth or terraced) and the route ribbon draped over it. Display
 * only: route analysis reads source elevations (route-analysis.ts) and never these heights.
 */
import type { FramePoint } from './real-terrain-projection';
import { createRoadRibbonBuffers, getRoadHalfWidth } from './road-ribbons';
import { terrainCircleSegments, type TerrainCropShape } from './terrain-crop';
import { getFrameUnitsPerMm, type TerrainModelSettings } from './terrain-model';
import { sampleHeightField, terrain3dElevationScale } from './terrain-surface';
import type { TerrainSurfaceBuffers } from './terrain-surface';
import { createTerraceHeightSampler, type TerraceHeightSampler } from './terrain-terraces';
import type { HeightField } from './types/terrain';
import type { RoadPath } from './types/roads';

/** The surface as drawn, in the crop units overlays are projected into. */
export interface DisplayedSurface {
  field: HeightField;
  width: number;
  height: number;
  shape: TerrainCropShape;
  frameUnitsPerMm: number;
  /** Terraced surfaces step between flat shelves, so overlays must drop at each riser. */
  isTerraced: boolean;
  /** Landscape-local preview-unit height at a crop-unit point; undefined off the model. */
  heightAt(point: FramePoint): number | undefined;
}

export interface DisplayedSurfaceInputs {
  field: HeightField;
  width: number;
  height: number;
  modelSettings: TerrainModelSettings;
  exaggeration: number;
  /** Preview-unit height of terrain elevation zero, matching contour lines. */
  elevationOffset: number;
  /** Terraced models only: the model's top surface in millimetres, as printed. */
  terracedSurfaceMm?: TerrainSurfaceBuffers;
}

export interface RouteRibbonBuffers {
  positions: Float32Array;
  indices: Uint32Array;
  /** Drawn centre-line points: each contributes a left and a right vertex. */
  pointCount: number;
}

/**
 * Terraced routes sample at a quarter cell so narrow shelves are not skipped, then bisect each
 * step crossing to a thousandth of a cell. The ribbon then drops vertically at the riser instead
 * of ramping through the shelf above, which sub-cell sampling alone would still do.
 */
const terraceSampleFraction = 0.25;
const stepBisections = 10;
/** Shelves per sample interval a steep route may cross; more means a degenerate surface. */
const maximumStepsPerInterval = 64;

// === PUBLIC API ===

export function createDisplayedSurface(inputs: DisplayedSurfaceInputs): DisplayedSurface {
  const { field, width, height, modelSettings, exaggeration, elevationOffset } = inputs;
  const shape = modelSettings.cropShape ?? 'rectangle';
  const frameUnitsPerMm = getFrameUnitsPerMm(width, height, modelSettings);
  const base = { field, width, height, shape, frameUnitsPerMm };
  const isOnModel = createFootprintTest(width, height, shape);
  const { terracedSurfaceMm } = inputs;

  if (!terracedSurfaceMm) {
    return {
      ...base,
      isTerraced: false,
      heightAt: (point) =>
        isOnModel(point)
          ? sampleHeightField(field, point.x, point.y) * terrain3dElevationScale * exaggeration +
            elevationOffset
          : undefined,
    };
  }

  // Model millimetres are centred on the crop; preview units span its longer side as 2.
  const previewUnitsPerMm = (2 / Math.max(width, height)) * frameUnitsPerMm;
  const pullInside = createPolygonPull(width, height, shape);
  // Built on first use, so terraced models without a route never pay for the shelf index.
  let sampleShelf: TerraceHeightSampler | undefined;

  return {
    ...base,
    isTerraced: true,
    heightAt(point) {
      if (!isOnModel(point)) {
        return undefined;
      }

      const inside = pullInside(point);

      sampleShelf ??= createTerraceHeightSampler(terracedSurfaceMm);
      const shelfMm = sampleShelf(
        (inside.x - width / 2) / frameUnitsPerMm,
        (inside.y - height / 2) / frameUnitsPerMm,
      );

      return shelfMm === undefined ? undefined : shelfMm * previewUnitsPerMm;
    },
  };
}

/**
 * Drapes the route ribbon over the displayed surface in preview units, `liftUnits` clear of it.
 * Smooth ribbons tilt with side slopes. Terraced ribbons stay level across their width at the
 * highest shelf under them, a lift's width ahead and behind too, so they cap each riser's edge
 * rather than sinking into it, and they drop between shelves exactly where a step falls.
 */
export function createRouteRibbonBuffers(
  paths: readonly RoadPath[],
  surface: DisplayedSurface,
  widthMm: number,
  liftUnits: number,
): RouteRibbonBuffers {
  const halfWidth = getRoadHalfWidth('secondary', widthMm, surface.frameUnitsPerMm);
  const scale = 2 / Math.max(surface.width, surface.height);
  const liftCropUnits = liftUnits / scale;
  const capHeight = (left: FramePoint, right: FramePoint) =>
    getCapHeight(surface, left, right, liftCropUnits);
  const draped = surface.isTerraced
    ? paths.map((path) => ({
        ...path,
        points: insertTerraceSteps(path.points, surface.field.spacing, halfWidth, capHeight),
      }))
    : paths;
  const buffers = createRoadRibbonBuffers(
    draped,
    surface.field,
    surface.width,
    surface.height,
    { detail: 'tracks', widthMm },
    surface.frameUnitsPerMm,
    surface.shape,
  );
  const { positions } = buffers;
  const toCrop = (vertex: number) => ({
    x: positions[vertex * 3] / scale + surface.width / 2,
    y: positions[vertex * 3 + 2] / scale + surface.height / 2,
  });
  let previousHeight = 0;

  for (let vertex = 0; vertex < positions.length / 3; vertex += 2) {
    const left = toCrop(vertex);
    const right = toCrop(vertex + 1);
    const level = surface.isTerraced ? capHeight(left, right) : undefined;
    const heights = surface.isTerraced
      ? [level, level]
      : [surface.heightAt(left), surface.heightAt(right)];

    heights.forEach((value, side) => {
      // Ribbon edges are clamped onto the model, so a miss is float noise at its rim.
      previousHeight = value ?? previousHeight;
      positions[(vertex + side) * 3 + 1] = previousHeight + liftUnits;
    });
  }

  return { ...buffers, pointCount: positions.length / 6 };
}

// === HELPERS ===

/** Highest displayed height across the ribbon and a lift ahead and behind; undefined off-model. */
function getCapHeight(
  surface: DisplayedSurface,
  left: FramePoint,
  right: FramePoint,
  reach: number,
): number | undefined {
  const across = Math.hypot(right.x - left.x, right.y - left.y) || 1;
  const along = {
    x: (-(right.y - left.y) / across) * reach,
    y: ((right.x - left.x) / across) * reach,
  };
  const centre = { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
  let highest: number | undefined;

  for (const point of [left, centre, right]) {
    for (const shift of [-1, 0, 1]) {
      const height = surface.heightAt({
        x: point.x + along.x * shift,
        y: point.y + along.y * shift,
      });

      highest = height === undefined ? highest : Math.max(highest ?? -Infinity, height);
    }
  }

  return highest;
}

/** Densifies a path below cell size and adds a close pair of points at every shelf change. */
function insertTerraceSteps(
  points: readonly FramePoint[],
  cellUnits: number,
  halfWidth: number,
  capHeight: (left: FramePoint, right: FramePoint) => number | undefined,
): FramePoint[] {
  const stepped: FramePoint[] = points.length > 0 ? [points[0]] : [];
  const intervalUnits = cellUnits * terraceSampleFraction;

  for (let index = 1; index < points.length; index++) {
    const start = points[index - 1];
    const end = points[index];
    const length = Math.hypot(end.x - start.x, end.y - start.y);

    if (length === 0) {
      continue;
    }

    const normal = {
      x: (-(end.y - start.y) / length) * halfWidth,
      y: ((end.x - start.x) / length) * halfWidth,
    };
    const at = (t: number) => ({
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
    });

    const heightAt = (t: number) => {
      const centre = at(t);

      return capHeight(
        { x: centre.x + normal.x, y: centre.y + normal.y },
        { x: centre.x - normal.x, y: centre.y - normal.y },
      );
    };

    const intervals = Math.ceil(length / intervalUnits);

    for (let interval = 0; interval < intervals; interval++) {
      const to = (interval + 1) / intervals;
      const endHeight = heightAt(to);
      let from = interval / intervals;

      for (let step = 0; step < maximumStepsPerInterval && heightAt(from) !== endHeight; step++) {
        const [low, high] = bisectStep(from, to, heightAt);

        stepped.push(at(low), at(high));
        from = high;
      }

      stepped.push(at(to));
    }
  }

  return stepped;
}

/** Narrows `[from, to]` around the first place the height changes from its value at `from`. */
function bisectStep(
  from: number,
  to: number,
  heightAt: (t: number) => number | undefined,
): [number, number] {
  const startHeight = heightAt(from);
  let low = from;
  let high = to;

  for (let iteration = 0; iteration < stepBisections; iteration++) {
    const middle = (low + high) / 2;

    if (heightAt(middle) === startHeight) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return [low, high];
}

function createFootprintTest(
  width: number,
  height: number,
  shape: TerrainCropShape,
): (point: FramePoint) => boolean {
  // Ribbon edges are clamped exactly onto the rim; this keeps float noise there on the model.
  const slack = Math.max(width, height) * 1e-9;

  if (shape === 'circle') {
    const radius = width / 2;

    return (point) => Math.hypot(point.x - radius, point.y - radius) <= radius + slack;
  }

  return (point) =>
    point.x >= -slack && point.x <= width + slack && point.y >= -slack && point.y <= height + slack;
}

/** Moves rim points onto the surface mesh, whose circle is an inscribed polygon. */
function createPolygonPull(
  width: number,
  height: number,
  shape: TerrainCropShape,
): (point: FramePoint) => FramePoint {
  if (shape === 'rectangle') {
    return (point) => ({
      x: Math.max(0, Math.min(width, point.x)),
      y: Math.max(0, Math.min(height, point.y)),
    });
  }

  const radius = width / 2;
  const inscribed = radius * Math.cos(Math.PI / terrainCircleSegments);

  return (point) => {
    const distance = Math.hypot(point.x - radius, point.y - radius);

    return distance <= inscribed
      ? point
      : {
          x: radius + ((point.x - radius) * inscribed) / distance,
          y: radius + ((point.y - radius) * inscribed) / distance,
        };
  };
}
