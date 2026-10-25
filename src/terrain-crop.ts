import { sampleHeightField, terrain3dElevationScale } from './terrain-surface';
import type { TerrainSurfaceBuffers } from './terrain-surface';
import type { HeightField } from './types/terrain';

export const terrainCircleSegments = 512;

export type TerrainCropShape = 'rectangle' | 'circle';
export interface TerrainCropSettings {
  centerX: number;
  centerY: number;
  size: number;
}
export const defaultTerrainCrop: Readonly<TerrainCropSettings> = Object.freeze({
  centerX: 0.5,
  centerY: 0.5,
  size: 1,
});

/** Size is a fraction of the largest crop that fits, with its center constrained to the source. */
export function getTerrainCropBounds(
  width: number,
  height: number,
  ratio: number,
  crop: TerrainCropSettings,
): { x: number; y: number; width: number; height: number; crop: TerrainCropSettings } {
  const size = Math.max(0.1, Math.min(1, crop.size));
  const cropWidth = Math.min(width, height * ratio) * size;
  const cropHeight = Math.min(height, width / ratio) * size;
  const centerX = Math.max(cropWidth / 2, Math.min(width - cropWidth / 2, crop.centerX * width));
  const centerY = Math.max(
    cropHeight / 2,
    Math.min(height - cropHeight / 2, crop.centerY * height),
  );

  return {
    x: centerX - cropWidth / 2,
    y: centerY - cropHeight / 2,
    width: cropWidth,
    height: cropHeight,
    crop: { size, centerX: centerX / width, centerY: centerY / height },
  };
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
