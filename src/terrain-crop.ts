import { clipTerrainSegment, sampleHeightField, terrain3dElevationScale } from './terrain-surface';
import type { TerrainSurfaceBuffers } from './terrain-surface';
import type { HeightField } from './types/terrain';

export const terrainCircleSegments = 512;

export type TerrainCropShape = 'rectangle' | 'circle' | 'triangle' | 'polygon';
export interface CropPoint {
  x: number;
  y: number;
}
export interface TerrainCropSettings {
  centerX: number;
  centerY: number;
  size: number;
  /** Clockwise turn of the crop frame in the source; absent means unrotated. */
  rotationDegrees?: number;
}
/** Where a model ends, in crop units; polygon outlines run clockwise on screen around the crop center. */
export interface CropFootprint {
  shape: TerrainCropShape;
  width: number;
  height: number;
  outline?: readonly CropPoint[];
}
export const defaultTerrainCrop: Readonly<TerrainCropSettings> = Object.freeze({
  centerX: 0.5,
  centerY: 0.5,
  size: 1,
});

/** Corners of the triangle crop, in the crop box's normalized coordinates. */
export const triangleCropOutline: readonly CropPoint[] = Object.freeze([
  { x: 0.5, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
]);

/** The editable polygon starts as a hexagon so there is something obvious to drag. */
export const defaultCropPolygon: readonly CropPoint[] = Object.freeze(
  Array.from({ length: 6 }, (_, index) => {
    const angle = ((index * 60 - 90) * Math.PI) / 180;

    return { x: 0.5 + Math.cos(angle) / 2, y: 0.5 + Math.sin(angle) / 2 };
  }),
);

/**
 * Size is a fraction of the largest crop that fits, with its center constrained to the source.
 * A rotated frame must fit by its bounding box; circles look the same at any angle.
 */
export function getTerrainCropBounds(
  width: number,
  height: number,
  ratio: number,
  crop: TerrainCropSettings,
  isRound = false,
): { x: number; y: number; width: number; height: number; crop: TerrainCropSettings } {
  const size = Math.max(0.1, Math.min(1, crop.size));
  const rotationDegrees = normalizeRotationDegrees(crop.rotationDegrees ?? 0);
  const fullWidth = Math.min(width, height * ratio);
  const fullHeight = Math.min(height, width / ratio);
  const { horizontal, vertical } = getRotatedExtent(
    fullWidth,
    fullHeight,
    isRound ? 0 : rotationDegrees,
  );
  const fit = Math.min(1, width / horizontal, height / vertical) * size;
  const cropWidth = fullWidth * fit;
  const cropHeight = fullHeight * fit;
  const halfX = (horizontal * fit) / 2;
  const halfY = (vertical * fit) / 2;
  const centerX = Math.max(halfX, Math.min(width - halfX, crop.centerX * width));
  const centerY = Math.max(halfY, Math.min(height - halfY, crop.centerY * height));

  return {
    x: centerX - cropWidth / 2,
    y: centerY - cropHeight / 2,
    width: cropWidth,
    height: cropHeight,
    crop: {
      size,
      centerX: centerX / width,
      centerY: centerY / height,
      ...(rotationDegrees !== 0 ? { rotationDegrees } : {}),
    },
  };
}

/** Wraps to (-180, 180] so equal turns compare equal. */
export function normalizeRotationDegrees(degrees: number): number {
  if (!Number.isFinite(degrees)) {
    return 0;
  }

  const wrapped = ((((degrees + 180) % 360) + 360) % 360) - 180;

  return wrapped === -180 ? 180 : wrapped;
}

/** Maps a source point into an unrotated crop box whose top-left is the origin. */
export function sourceToCropPoint(
  crop: { x: number; y: number; width: number; height: number; rotationRadians: number },
  point: CropPoint,
): CropPoint {
  const dx = point.x - crop.x - crop.width / 2;
  const dy = point.y - crop.y - crop.height / 2;
  const cos = Math.cos(crop.rotationRadians);
  const sin = Math.sin(crop.rotationRadians);

  return {
    x: dx * cos + dy * sin + crop.width / 2,
    y: -dx * sin + dy * cos + crop.height / 2,
  };
}

/** The footprint a model of this shape occupies inside a `width × height` crop. */
export function getCropFootprint(
  shape: TerrainCropShape | undefined,
  polygon: readonly CropPoint[] | undefined,
  width: number,
  height: number,
): CropFootprint {
  const resolved = shape ?? 'rectangle';
  const normalized =
    resolved === 'triangle'
      ? triangleCropOutline
      : resolved === 'polygon'
        ? (polygon ?? defaultCropPolygon)
        : undefined;

  if (!normalized) {
    return { shape: resolved, width, height };
  }

  const outline = normalized.map((p) => ({ x: p.x * width, y: p.y * height }));

  return {
    shape: resolved,
    width,
    height,
    outline: isClockwise(outline) ? outline : outline.reverse(),
  };
}

/**
 * True when every edge faces the crop center, so a fan from the center covers the polygon once.
 * The mesh, base and clipping all rely on this.
 */
export function isStarShapedCropPolygon(points: readonly CropPoint[]): boolean {
  if (points.length < 3 || points.some((p) => !(p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1))) {
    return false;
  }

  let sign = 0;
  let turn = 0;

  for (let index = 0; index < points.length; index++) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const cross = (a.x - 0.5) * (b.y - 0.5) - (a.y - 0.5) * (b.x - 0.5);
    const dot = (a.x - 0.5) * (b.x - 0.5) + (a.y - 0.5) * (b.y - 0.5);

    if (Math.abs(cross) < 1e-9 || (sign !== 0 && Math.sign(cross) !== sign)) {
      return false;
    }

    sign = Math.sign(cross);
    turn += Math.atan2(cross, dot);
  }

  return Math.abs(Math.abs(turn) - Math.PI * 2) < 1e-6;
}

/** Splits a segment into the pieces that lie on the footprint. */
export function clipFootprintSegment(
  a: CropPoint,
  b: CropPoint,
  footprint: CropFootprint,
): [CropPoint, CropPoint][] {
  if (footprint.shape === 'circle') {
    const segment = clipCircleSegment(a, b, footprint.width);

    return segment ? [segment] : [];
  }

  if (!footprint.outline) {
    const segment = clipTerrainSegment(a, b, footprint.width, footprint.height);

    return segment ? [segment] : [];
  }

  const intervals = getFanTriangles(footprint)
    .map((triangle) => clipSegmentToTriangle(a, b, triangle))
    .filter((interval): interval is [number, number] => interval !== undefined)
    .sort((first, second) => first[0] - second[0]);
  const merged: [number, number][] = [];

  for (const interval of intervals) {
    const last = merged.at(-1);

    if (last && interval[0] <= last[1] + 1e-9) {
      last[1] = Math.max(last[1], interval[1]);
    } else {
      merged.push([...interval]);
    }
  }

  const at = (t: number) =>
    t === 0 ? a : t === 1 ? b : { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };

  return merged.map(([start, end]) => [at(start), at(end)]);
}

export function isInsideCropFootprint(point: CropPoint, footprint: CropFootprint): boolean {
  if (footprint.shape === 'circle') {
    const radius = footprint.width / 2;

    return Math.hypot(point.x - radius, point.y - radius) <= radius;
  }

  if (!footprint.outline) {
    return (
      point.x >= 0 && point.x <= footprint.width && point.y >= 0 && point.y <= footprint.height
    );
  }

  return getFanTriangles(footprint).some(
    (triangle) => clipSegmentToTriangle(point, point, triangle) !== undefined,
  );
}

/** The nearest footprint point, so geometry at the edge never overhangs the base. */
export function clampToCropFootprint(point: CropPoint, footprint: CropFootprint): CropPoint {
  if (footprint.shape === 'circle') {
    const radius = footprint.width / 2;
    const distance = Math.hypot(point.x - radius, point.y - radius);

    return distance <= radius
      ? point
      : {
          x: radius + ((point.x - radius) * radius) / distance,
          y: radius + ((point.y - radius) * radius) / distance,
        };
  }

  if (!footprint.outline) {
    return {
      x: Math.max(0, Math.min(footprint.width, point.x)),
      y: Math.max(0, Math.min(footprint.height, point.y)),
    };
  }

  if (isInsideCropFootprint(point, footprint)) {
    return point;
  }

  const outline = footprint.outline;
  let nearest = outline[0];
  let nearestDistance = Infinity;

  for (let index = 0; index < outline.length; index++) {
    const a = outline[index];
    const b = outline[(index + 1) % outline.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(
      0,
      Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)),
    );
    const candidate = { x: a.x + dx * t, y: a.y + dy * t };
    const distance = Math.hypot(point.x - candidate.x, point.y - candidate.y);

    if (distance < nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }

  return nearest;
}

/**
 * Rings are scaled copies of the outline around the crop center, like the circle's polar grid:
 * the boundary is exact, corners stay sharp, and the center vertex anchors the base fan.
 */
export function createOutlineTerrainSurface(
  field: HeightField,
  footprint: CropFootprint & { outline: readonly CropPoint[] },
): TerrainSurfaceBuffers {
  const { width, height, outline } = footprint;
  const centerX = width / 2;
  const centerY = height / 2;
  const scale = 2 / Math.max(width, height);
  const boundary: CropPoint[] = [];

  for (let index = 0; index < outline.length; index++) {
    const a = outline[index];
    const b = outline[(index + 1) % outline.length];
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / field.spacing));

    for (let step = 0; step < steps; step++) {
      boundary.push({
        x: a.x + ((b.x - a.x) * step) / steps,
        y: a.y + ((b.y - a.y) * step) / steps,
      });
    }
  }

  const reach = Math.max(...boundary.map((p) => Math.hypot(p.x - centerX, p.y - centerY)));
  const rings = Math.max(2, Math.ceil(reach / field.spacing));
  const segments = boundary.length;
  const positions = new Float32Array((1 + rings * segments) * 3);
  const indices: number[] = [];

  positions[1] = sampleHeightField(field, centerX, centerY) * terrain3dElevationScale;

  for (let ring = 1; ring <= rings; ring++) {
    for (let segment = 0; segment < segments; segment++) {
      const x = centerX + ((boundary[segment].x - centerX) * ring) / rings;
      const y = centerY + ((boundary[segment].y - centerY) * ring) / rings;
      const offset = (1 + (ring - 1) * segments + segment) * 3;

      positions[offset] = (x - centerX) * scale;
      positions[offset + 1] = sampleHeightField(field, x, y) * terrain3dElevationScale;
      positions[offset + 2] = (y - centerY) * scale;
      const b = offset / 3;
      const c = 1 + (ring - 1) * segments + ((segment + 1) % segments);

      if (ring === 1) {
        indices.push(0, c, b);
      } else {
        const a = b - segments;
        const d = c - segments;

        indices.push(a, c, b, a, d, c);
      }
    }
  }

  return { positions, indices: new Uint32Array(indices) };
}

/** A polar grid gives the circle a shared, exact boundary without clipping cracks or T-junctions. */
export function createCircularTerrainSurface(
  field: HeightField,
  diameter: number,
): TerrainSurfaceBuffers {
  const rings = Math.max(2, Math.ceil(diameter / (2 * field.spacing)));
  const segments = terrainCircleSegments;
  const positions = new Float32Array((1 + rings * segments) * 3);
  const indices: number[] = [];

  positions[1] = sampleHeightField(field, diameter / 2, diameter / 2) * terrain3dElevationScale;

  for (let ring = 1; ring <= rings; ring++) {
    for (let segment = 0; segment < segments; segment++) {
      const angle = (segment / segments) * Math.PI * 2;
      const x = (Math.cos(angle) * ring) / rings;
      const z = (Math.sin(angle) * ring) / rings;
      const offset = (1 + (ring - 1) * segments + segment) * 3;

      positions[offset] = x;
      positions[offset + 1] =
        sampleHeightField(field, ((x + 1) * diameter) / 2, ((z + 1) * diameter) / 2) *
        terrain3dElevationScale;
      positions[offset + 2] = z;
      const b = offset / 3;
      const c = 1 + (ring - 1) * segments + ((segment + 1) % segments);

      if (ring === 1) {
        indices.push(0, c, b);
      } else {
        const a = b - segments;
        const d = c - segments;

        indices.push(a, c, b, a, d, c);
      }
    }
  }

  return { positions, indices: new Uint32Array(indices) };
}

/** Clips one segment to the same circular footprint used by the model. */
export function clipCircleSegment(
  a: { x: number; y: number },
  b: { x: number; y: number },
  diameter: number,
): [{ x: number; y: number }, { x: number; y: number }] | undefined {
  const radius = diameter / 2;
  const ax = a.x - radius;
  const ay = a.y - radius;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return undefined;
  }

  const projection = ax * dx + ay * dy;
  const discriminant =
    projection * projection - lengthSquared * (ax * ax + ay * ay - radius * radius);

  if (discriminant <= 0) {
    return undefined;
  }

  const start = Math.max(0, (-projection - Math.sqrt(discriminant)) / lengthSquared);
  const end = Math.min(1, (-projection + Math.sqrt(discriminant)) / lengthSquared);

  if (start >= end) {
    return undefined;
  }

  return [
    { x: a.x + dx * start, y: a.y + dy * start },
    { x: a.x + dx * end, y: a.y + dy * end },
  ];
}

/** Clips convex water polygons to a smooth inscribed circle for the preview. */
export function clipCirclePolygon(
  points: { x: number; y: number }[],
  diameter: number,
): { x: number; y: number }[] {
  const radius = diameter / 2;

  if (points.every((p) => Math.hypot(p.x - radius, p.y - radius) <= radius)) {
    return points;
  }

  const left = Math.min(...points.map((p) => p.x));
  const right = Math.max(...points.map((p) => p.x));
  const top = Math.min(...points.map((p) => p.y));
  const bottom = Math.max(...points.map((p) => p.y));

  if (
    Math.hypot(
      Math.max(left - radius, 0, radius - right),
      Math.max(top - radius, 0, radius - bottom),
    ) >= radius
  ) {
    return [];
  }

  let polygon = points;

  for (let side = 0; side < terrainCircleSegments && polygon.length > 0; side++) {
    const angle = ((side + 0.5) / terrainCircleSegments) * Math.PI * 2;
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const limit = radius * Math.cos(Math.PI / terrainCircleSegments);
    const distance = (p: { x: number; y: number }) =>
      (p.x - radius) * nx + (p.y - radius) * ny - limit;
    const clipped: { x: number; y: number }[] = [];

    for (let index = 0; index < polygon.length; index++) {
      const a = polygon[index];
      const b = polygon[(index + 1) % polygon.length];
      const da = distance(a);
      const db = distance(b);

      if (da <= 0) {
        clipped.push(a);
      }

      if (da <= 0 !== db <= 0) {
        const t = da / (da - db);

        clipped.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }

    polygon = clipped;
  }

  return polygon;
}

// === HELPERS ===

/** Width and height of the axis-aligned box around a rotated `width × height` frame. */
export function getRotatedExtent(
  width: number,
  height: number,
  rotationDegrees: number,
): { horizontal: number; vertical: number } {
  const radians = (rotationDegrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));

  return { horizontal: width * cos + height * sin, vertical: width * sin + height * cos };
}

function isClockwise(points: readonly CropPoint[]): boolean {
  let area = 0;

  for (let index = 0; index < points.length; index++) {
    const a = points[index];
    const b = points[(index + 1) % points.length];

    area += a.x * b.y - b.x * a.y;
  }

  return area > 0;
}

/** The center-to-edge fan that partitions a star-shaped outline into convex pieces. */
function getFanTriangles(footprint: CropFootprint): [CropPoint, CropPoint, CropPoint][] {
  const outline = footprint.outline ?? [];
  const center = { x: footprint.width / 2, y: footprint.height / 2 };

  return outline.map((point, index) => [center, point, outline[(index + 1) % outline.length]]);
}

/** Cyrus–Beck against one clockwise triangle; returns the inside parameter range, if any. */
function clipSegmentToTriangle(
  a: CropPoint,
  b: CropPoint,
  triangle: readonly [CropPoint, CropPoint, CropPoint],
): [number, number] | undefined {
  let start = 0;
  let end = 1;
  const tolerance = 1e-12;

  for (let index = 0; index < 3; index++) {
    const p = triangle[index];
    const q = triangle[(index + 1) % 3];
    // Inward-facing for clockwise-on-screen (positive cross) triangles.
    const normalX = -(q.y - p.y);
    const normalY = q.x - p.x;
    const distance = (a.x - p.x) * normalX + (a.y - p.y) * normalY;
    const rate = (b.x - a.x) * normalX + (b.y - a.y) * normalY;
    const slack = tolerance * Math.hypot(normalX, normalY);

    if (rate === 0) {
      if (distance < -slack) {
        return undefined;
      }
    } else if (rate > 0) {
      start = Math.max(start, -(distance + slack) / rate);
    } else {
      end = Math.min(end, -(distance + slack) / rate);
    }
  }

  return start <= end ? [Math.max(0, start), Math.min(1, end)] : undefined;
}
