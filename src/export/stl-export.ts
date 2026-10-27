import type { TerrainSurfaceBuffers } from '../terrain-surface';

/** Checks topology before writing STL, which otherwise silently accepts open surfaces. */
export function validatePrintableSolid(mesh: TerrainSurfaceBuffers): void {
  const edges = new Map<string, { count: number; direction: number }>();
  let volume = 0;

  for (const value of mesh.positions) {
    if (!Number.isFinite(value)) {
      throw new Error('Model contains nonfinite coordinates.');
    }
  }

  for (let offset = 0; offset < mesh.indices.length; offset += 3) {
    const ids = Array.from(mesh.indices.subarray(offset, offset + 3));

    if (ids.length !== 3 || ids.some((id) => id * 3 + 2 >= mesh.positions.length)) {
      throw new Error('Model contains invalid triangles.');
    }

    const [a, b, c] = ids.map((id) => Array.from(mesh.positions.subarray(id * 3, id * 3 + 3)));
    const ab = b.map((value, i) => value - a[i]);
    const ac = c.map((value, i) => value - a[i]);
    const normal = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];

    if (Math.hypot(...normal) === 0) {
      throw new Error(
        'Model contains degenerate triangles. Reduce the base aspect ratio and retry.',
      );
    }

    volume +=
      a[0] * (b[1] * c[2] - b[2] * c[1]) +
      a[1] * (b[2] * c[0] - b[0] * c[2]) +
      a[2] * (b[0] * c[1] - b[1] * c[0]);

    for (let side = 0; side < 3; side++) {
      const start = ids[side];
      const end = ids[(side + 1) % 3];
      const key = `${Math.min(start, end)}:${Math.max(start, end)}`;
      const edge = edges.get(key) ?? { count: 0, direction: 0 };

      edge.count++;
      edge.direction += start < end ? 1 : -1;
      edges.set(key, edge);
    }
  }

  if (
    edges.size === 0 ||
    [...edges.values()].some(({ count, direction }) => count !== 2 || direction !== 0)
  ) {
    throw new Error(
      'Model is not a closed, consistently oriented solid. Reload terrain and retry.',
    );
  }

  if (!(volume > 0)) {
    throw new Error('Model must have positive volume.');
  }
}

const stlHeaderBytes = 80;

/**
 * Binary STL in millimeters; rotates Y-up model coordinates into Z-up print coordinates.
 * `label` leads the 80-byte header, so slicers show which part a file holds.
 */
export function createBinaryStl(
  mesh: TerrainSurfaceBuffers,
  label = 'Topogra terrain model',
): ArrayBuffer {
  validatePrintableSolid(mesh);
  const header = new TextEncoder().encode(`${label} | units: millimeters | Z up`);

  // Bytes past 80 would land in the triangle count.
  if (header.length > stlHeaderBytes) {
    throw new Error(
      `STL label "${label}" makes a ${header.length}-byte header; the limit is ${stlHeaderBytes}. Shorten the label.`,
    );
  }

  const count = mesh.indices.length / 3;
  const buffer = new ArrayBuffer(84 + count * 50);
  const bytes = new Uint8Array(buffer);

  bytes.set(header);
  const data = new DataView(buffer);

  data.setUint32(80, count, true);

  for (let triangle = 0; triangle < count; triangle++) {
    const vertices = [0, 1, 2].map((corner) => {
      const offset = mesh.indices[triangle * 3 + corner] * 3;

      return [mesh.positions[offset], -mesh.positions[offset + 2], mesh.positions[offset + 1]];
    });
    const [a, b, c] = vertices;
    const ab = b.map((value, i) => value - a[i]);
    const ac = c.map((value, i) => value - a[i]);
    const normal = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    const length = Math.hypot(...normal);
    const values = [...normal.map((value) => value / length), ...vertices.flat()];

    values.forEach((value, index) => {
      data.setFloat32(84 + triangle * 50 + index * 4, value, true);
    });
  }

  return buffer;
}
