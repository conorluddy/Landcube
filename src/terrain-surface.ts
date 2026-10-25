import type { ContourPoint } from './types/contours';
import type { HeightField } from './types/terrain';

/** Shared vertical scale keeps the surface, contours, and sea-level plane aligned. */
export const terrain3dElevationScale = 0.65;

export interface TerrainSurfaceBuffers {
  positions: Float32Array;
  indices: Uint32Array;
}

/** Closes the surface boundary down to a flat base, with separate vertices for crisp edges. */
export function createTerrainBaseBuffers(surface: TerrainSurfaceBuffers): TerrainSurfaceBuffers {
  const edges = new Map<string, [number, number]>();
  let floor = Infinity;

  for (let offset = 1; offset < surface.positions.length; offset += 3) {
    floor = Math.min(floor, surface.positions[offset]);
  }

  floor -= 0.15;

  for (let offset = 0; offset < surface.indices.length; offset += 3) {
    const triangle = surface.indices.subarray(offset, offset + 3);

    for (let index = 0; index < 3; index++) {
      const a = triangle[index];
      const b = triangle[(index + 1) % 3];
      const key = `${Math.min(a, b)}:${Math.max(a, b)}`;

      if (edges.has(key)) {
        edges.delete(key);
      } else {
        edges.set(key, [a, b]);
      }
    }
  }

  const positions: number[] = [];
  const indices: number[] = [];

  for (const [a, b] of edges.values()) {
    const ax = surface.positions[a * 3];
    const ay = surface.positions[a * 3 + 1];
    const az = surface.positions[a * 3 + 2];
    const bx = surface.positions[b * 3];
    const by = surface.positions[b * 3 + 1];
    const bz = surface.positions[b * 3 + 2];
    const start = positions.length / 3;

    positions.push(ax, ay, az, bx, by, bz, ax, floor, az, bx, floor, bz);
    indices.push(start + 1, start, start + 2, start + 1, start + 2, start + 3);
    // Separate bottom vertices keep its normals independent from the side walls.
    positions.push(ax, floor, az, bx, floor, bz, 0, floor, 0);
    indices.push(start + 5, start + 4, start + 6);
  }

  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}

/** Samples the existing field at the image boundary without changing terrain generation. */
export function sampleHeightField(field: HeightField, x: number, y: number): number {
  const column = Math.max(0, Math.min(field.columns - 1, (x - field.originX) / field.spacing));
  const row = Math.max(0, Math.min(field.rows - 1, (y - field.originY) / field.spacing));
  const left = Math.floor(column);
  const top = Math.floor(row);
  const right = Math.min(left + 1, field.columns - 1);
  const bottom = Math.min(top + 1, field.rows - 1);
  const fx = column - left;
  const fy = row - top;
  const upper =
    field.values[top * field.columns + left] * (1 - fx) +
    field.values[top * field.columns + right] * fx;
  const lower =
    field.values[bottom * field.columns + left] * (1 - fx) +
    field.values[bottom * field.columns + right] * fx;

  return upper * (1 - fy) + lower * fy;
}

/** Builds an indexed, upward-facing surface cropped to the same frame as the 2D design. */
export function createTerrainSurfaceBuffers(
  field: HeightField,
  width: number,
  height: number,
): TerrainSurfaceBuffers {
  const axis = (origin: number, count: number, extent: number): number[] => {
    const values = [0];

    for (let index = 0; index < count; index++) {
      const value = origin + index * field.spacing;

      if (value > 0 && value < extent) {
        values.push(value);
      }
    }

    values.push(extent);

    return values;
  };

  const xs = axis(field.originX, field.columns, width);
  const ys = axis(field.originY, field.rows, height);
  const positions = new Float32Array(xs.length * ys.length * 3);
  const indices = new Uint32Array((xs.length - 1) * (ys.length - 1) * 6);
  const scale = 2 / Math.max(width, height);
  let vertexOffset = 0;
  let indexOffset = 0;

  for (const y of ys) {
    for (const x of xs) {
      positions[vertexOffset++] = (x - width / 2) * scale;
      positions[vertexOffset++] = sampleHeightField(field, x, y) * terrain3dElevationScale;
      positions[vertexOffset++] = (y - height / 2) * scale;
    }
  }

  for (let row = 0; row < ys.length - 1; row++) {
    for (let column = 0; column < xs.length - 1; column++) {
      const a = row * xs.length + column;
      const b = a + 1;
      const d = a + xs.length;
      const c = d + 1;

      indices.set([a, c, b, a, d, c], indexOffset);
      indexOffset += 6;
    }
  }

  return { positions, indices };
}

/** Crops contour segments to the surface rectangle while retaining their interpolated endpoints. */
export function clipTerrainSegment(
  a: ContourPoint,
  b: ContourPoint,
  width: number,
  height: number,
): [ContourPoint, ContourPoint] | undefined {
  let start = 0;
  let end = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;

  for (const [direction, distance] of [
    [-dx, a.x],
    [dx, width - a.x],
    [-dy, a.y],
    [dy, height - a.y],
  ]) {
    if (direction === 0) {
      if (distance < 0) {
        return undefined;
      }

      continue;
    }

    const fraction = distance / direction;

    if (direction < 0) {
      start = Math.max(start, fraction);
    } else {
      end = Math.min(end, fraction);
    }

    if (start > end) {
      return undefined;
    }
  }

  return [
    { x: a.x + dx * start, y: a.y + dy * start },
    { x: a.x + dx * end, y: a.y + dy * end },
  ];
}
