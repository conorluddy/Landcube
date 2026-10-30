import type { Contour } from './types/contours';
import type { TerrainSurfaceBuffers } from './terrain-surface';

/** Elevations in the shared height-field units, before 3D exaggeration. */
export interface TerrainTerraceLevels {
  origin: number;
  interval: number;
}

export interface TerracedTerrainBuffers {
  surface: TerrainSurfaceBuffers;
  base: TerrainSurfaceBuffers;
  solid: TerrainSurfaceBuffers;
  overallHeightMm: number;
  elevationOffsetMm: number;
  layerHeightMm: number;
  contourEdges: { a: { x: number; z: number }; b: { x: number; z: number }; elevation: number }[];
}

interface ShelfEdge {
  a: number;
  b: number;
  band: number;
}

/** Slices each source triangle at contour levels, then joins flat shelves with vertical risers. */
export function createTerracedTerrainBuffers(
  sampled: TerrainSurfaceBuffers,
  mmPerUnit: number,
  elevationScaleMm: number,
  baseThicknessMm: number,
  origin: number,
  interval: number,
): TerracedTerrainBuffers {
  if (!Number.isFinite(origin) || !Number.isFinite(interval) || interval <= 0) {
    throw new Error('Terraced terrain needs a finite positive contour interval.');
  }

  const layerHeightMm = interval * elevationScaleMm;
  const sourceBands: number[] = [];
  let minimumBand = Infinity;

  for (let i = 1; i < sampled.positions.length; i += 3) {
    const value = (sampled.positions[i] - origin) / interval;
    const nearest = Math.round(value);
    // A tiny upper-side tie break prevents shelves meeting only along a zero-width
    // vertical edge at exact-level saddles. Shelf elevations themselves stay exact.
    const band = Math.abs(value - nearest) < 1e-5 ? nearest + 1e-3 : value;

    if (!Number.isFinite(band)) {
      throw new Error('Terrain contains invalid elevations.');
    }

    sourceBands.push(band);
    minimumBand = Math.min(minimumBand, Math.floor(band));
  }

  const positions: number[] = [];
  const topIndices: number[] = [];
  const contourEdges: TerracedTerrainBuffers['contourEdges'] = [];
  const baseIndices: number[] = [];
  const nodes: { x: number; z: number }[] = [];
  const nodeIds = new Map<string, number>();
  const vertices = new Map<string, number>();
  const cuts = new Map<string, number>();
  const edges = new Map<string, ShelfEdge | null>();

  const vertex = (node: number, band: number | 'bottom') => {
    const key = `${node}:${band}`;
    const found = vertices.get(key);

    if (found !== undefined) {
      return found;
    }

    const id = positions.length / 3;

    positions.push(
      nodes[node].x,
      band === 'bottom' ? 0 : Math.fround(baseThicknessMm + (band - minimumBand) * layerHeightMm),
      nodes[node].z,
    );
    vertices.set(key, id);

    return id;
  };

  const node = (sourceX: number, sourceZ: number) => {
    const x = Math.fround(sourceX);
    const z = Math.fround(sourceZ);
    const key = `${x}:${z}`;
    const found = nodeIds.get(key);

    if (found !== undefined) {
      return found;
    }

    const id = nodes.length;

    nodes.push({ x, z });
    nodeIds.set(key, id);

    return id;
  };

  const sourceNodes = sourceBands.map((_, i) =>
    node(sampled.positions[i * 3] * mmPerUnit, sampled.positions[i * 3 + 2] * mmPerUnit),
  );

  const intersection = (first: number, second: number, level: number) => {
    const a = Math.min(first, second);
    const b = Math.max(first, second);

    const key = `${a}:${b}:${level}`;
    const found = cuts.get(key);

    if (found !== undefined) {
      return found;
    }

    const t = (level - sourceBands[a]) / (sourceBands[b] - sourceBands[a]);
    const p = nodes[sourceNodes[a]];
    const q = nodes[sourceNodes[b]];
    const result = node(p.x + (q.x - p.x) * t, p.z + (q.z - p.z) * t);

    cuts.set(key, result);

    return result;
  };

  const area = (a: number, b: number, c: number) =>
    (nodes[b].x - nodes[a].x) * (nodes[c].z - nodes[a].z) -
    (nodes[b].z - nodes[a].z) * (nodes[c].x - nodes[a].x);

  const shelfEdge = (a: number, b: number, band: number) => {
    const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
    const previous = edges.get(key);

    if (previous === null) {
      throw new Error('Terrace edges overlap. Increase the contour interval.');
    }

    if (previous === undefined) {
      edges.set(key, { a, b, band });
    } else {
      if (previous.a !== b || previous.b !== a) {
        throw new Error('Terrace edges have inconsistent orientation.');
      }

      if (previous.band !== band) {
        // Reverse both shelf edges to close the vertical face between them.
        const pa = vertex(previous.a, previous.band);
        const pb = vertex(previous.b, previous.band);
        const ca = vertex(a, band);
        const cb = vertex(b, band);

        topIndices.push(pb, pa, cb, pb, cb, ca);
        contourEdges.push({
          a: nodes[a],
          b: nodes[b],
          elevation: origin + Math.max(previous.band, band) * interval,
        });
      }

      edges.set(key, null);
    }
  };

  for (let i = 0; i < sampled.indices.length; i += 3) {
    const triangle = Array.from(sampled.indices.subarray(i, i + 3));
    const low = Math.floor(Math.min(...triangle.map((id) => sourceBands[id])));
    const high = Math.max(low, Math.ceil(Math.max(...triangle.map((id) => sourceBands[id]))) - 1);

    if (high - low > 2048 || topIndices.length > 3_000_000) {
      throw new Error('Too many terrace layers. Increase the contour interval or reduce density.');
    }

    for (let band = low; band <= high; band++) {
      const polygon: number[] = [];

      const append = (id: number) => {
        if (polygon.at(-1) !== id) {
          polygon.push(id);
        }
      };

      for (let side = 0; side < 3; side++) {
        const a = triangle[side];
        const b = triangle[(side + 1) % 3];
        const ha = sourceBands[a];
        const hb = sourceBands[b];

        if (ha >= band && ha <= band + 1) {
          append(sourceNodes[a]);
        }

        const levels = hb > ha ? [band, band + 1] : [band + 1, band];

        for (const level of levels) {
          if (level > Math.min(ha, hb) && level < Math.max(ha, hb)) {
            append(intersection(a, b, level));
          }
        }
      }

      if (polygon[0] === polygon.at(-1)) {
        polygon.pop();
      }

      if (polygon.length < 3) {
        continue;
      }

      // Rotate the fan to avoid degenerate triangles at collinear clipping points.
      const pivot = polygon.findIndex((_, offset) => {
        const order = polygon.map((__, index) => polygon[(offset + index) % polygon.length]);

        return order.slice(1, -1).every((id, index) => area(order[0], id, order[index + 2]) < 0);
      });

      if (pivot < 0) {
        continue;
      }

      const order = polygon.map((_, index) => polygon[(pivot + index) % polygon.length]);

      for (let j = 1; j < order.length - 1; j++) {
        topIndices.push(vertex(order[0], band), vertex(order[j], band), vertex(order[j + 1], band));
      }

      for (let j = 0; j < order.length; j++) {
        shelfEdge(order[j], order[(j + 1) % order.length], band);
      }
    }
  }

  // Split boundary walls at every meeting shelf height, avoiding T-junctions at step endpoints.
  const boundary = [...edges.values()].filter((edge): edge is ShelfEdge => edge !== null);
  const boundaryBands = new Map<number, Set<number>>();

  for (const { a, b, band } of boundary) {
    for (const id of [a, b]) {
      const bands = boundaryBands.get(id) ?? new Set<number>();

      bands.add(band);
      boundaryBands.set(id, bands);
    }
  }

  const bottomCenter = node(0, 0);
  const bottom = vertex(bottomCenter, 'bottom');

  for (const { a, b, band } of boundary) {
    const descending = [...(boundaryBands.get(a) ?? [])]
      .filter((value) => value < band)
      .sort((x, y) => y - x);
    const ascending = [...(boundaryBands.get(b) ?? [])]
      .filter((value) => value < band)
      .sort((x, y) => x - y);
    const perimeter = [
      vertex(b, band),
      vertex(a, band),
      ...descending.map((value) => vertex(a, value)),
      vertex(a, 'bottom'),
      vertex(b, 'bottom'),
      ...ascending.map((value) => vertex(b, value)),
    ];
    const center = positions.length / 3;

    positions.push(
      (nodes[a].x + nodes[b].x) / 2,
      (baseThicknessMm + (band - minimumBand) * layerHeightMm) / 2,
      (nodes[a].z + nodes[b].z) / 2,
    );

    for (let j = 0; j < perimeter.length; j++) {
      baseIndices.push(center, perimeter[j], perimeter[(j + 1) % perimeter.length]);
    }

    baseIndices.push(vertex(b, 'bottom'), vertex(a, 'bottom'), bottom);
  }

  const allPositions = new Float32Array(positions);
  let overallHeightMm = baseThicknessMm;

  for (let i = 1; i < positions.length; i += 3) {
    overallHeightMm = Math.max(overallHeightMm, positions[i]);
  }

  return {
    surface: { positions: allPositions, indices: new Uint32Array(topIndices) },
    base: { positions: allPositions, indices: new Uint32Array(baseIndices) },
    solid: { positions: allPositions, indices: new Uint32Array([...topIndices, ...baseIndices]) },
    overallHeightMm,
    elevationOffsetMm: baseThicknessMm - (origin + minimumBand * interval) * elevationScaleMm,
    layerHeightMm,
    contourEdges,
  };
}

/** Shelf height at a plan point, in the buffers' units; undefined off the model footprint. */
export type TerraceHeightSampler = (x: number, z: number) => number | undefined;

/**
 * Looks up the displayed height of a terraced surface by finding the shelf under a plan point,
 * so overlays sit on exactly the steps `createTerracedTerrainBuffers` cut rather than re-deriving
 * them. Risers are vertical and have no plan area; a point on a riser line resolves to the upper
 * shelf so anything resting there stays out of the step.
 */
export function createTerraceHeightSampler(surface: TerrainSurfaceBuffers): TerraceHeightSampler {
  const { positions, indices } = surface;
  const shelves: number[] = [];
  let minimumX = Infinity;
  let minimumZ = Infinity;
  let maximumX = -Infinity;
  let maximumZ = -Infinity;

  for (let offset = 0; offset < indices.length; offset += 3) {
    const [a, b, c] = [indices[offset], indices[offset + 1], indices[offset + 2]];

    if (Math.abs(getPlanArea(positions, a, b, c)) > 1e-12) {
      shelves.push(a, b, c);

      for (const id of [a, b, c]) {
        minimumX = Math.min(minimumX, positions[id * 3]);
        maximumX = Math.max(maximumX, positions[id * 3]);
        minimumZ = Math.min(minimumZ, positions[id * 3 + 2]);
        maximumZ = Math.max(maximumZ, positions[id * 3 + 2]);
      }
    }
  }

  // About two shelves per bucket keeps lookups constant time on any terrace density.
  const columns = Math.max(1, Math.min(1024, Math.ceil(Math.sqrt(shelves.length / 6))));
  const cellX = (maximumX - minimumX) / columns || 1;
  const cellZ = (maximumZ - minimumZ) / columns || 1;
  const toColumn = (x: number) =>
    Math.min(columns - 1, Math.max(0, Math.floor((x - minimumX) / cellX)));
  const toRow = (z: number) =>
    Math.min(columns - 1, Math.max(0, Math.floor((z - minimumZ) / cellZ)));
  const buckets = createShelfBuckets(positions, shelves, columns, toColumn, toRow);
  // Relative to the footprint, so float32 vertices on shared edges always match a shelf.
  const tolerance = Math.max(maximumX - minimumX, maximumZ - minimumZ) * 1e-9;

  return (x, z) => {
    if (
      !(x >= minimumX - tolerance && x <= maximumX + tolerance) ||
      !(z >= minimumZ - tolerance && z <= maximumZ + tolerance)
    ) {
      return undefined;
    }

    const cell = toRow(z) * columns + toColumn(x);
    let height: number | undefined;

    for (let entry = buckets.starts[cell]; entry < buckets.starts[cell + 1]; entry++) {
      const shelf = buckets.shelves[entry] * 3;

      if (isInsideShelf(positions, shelves, shelf, x, z, tolerance)) {
        height = Math.max(height ?? -Infinity, positions[shelves[shelf] * 3 + 1]);
      }
    }

    return height;
  };
}

/** Draw contours along the real upper edges of the risers, rather than over the former slopes. */
export function createTerraceContours(
  edges: TerracedTerrainBuffers['contourEdges'],
  source: readonly Contour[],
  width: number,
  height: number,
  mmPerUnit: number,
  elevationFactor: number,
  levels: TerrainTerraceLevels,
): Contour[] {
  const contours = source.map((contour) => ({ ...contour, paths: [] as Contour['paths'] }));
  const byLevel = new Map(
    contours.map((contour) => [
      Math.round((contour.elevation - levels.origin) / levels.interval),
      contour,
    ]),
  );
  const scale = Math.max(width, height) / (mmPerUnit * 2);

  for (const edge of edges) {
    const contour = byLevel.get(
      Math.round((edge.elevation / elevationFactor - levels.origin) / levels.interval),
    );

    contour?.paths.push({
      closed: false,
      points: [
        { x: edge.a.x * scale + width / 2, y: edge.a.z * scale + height / 2 },
        { x: edge.b.x * scale + width / 2, y: edge.b.z * scale + height / 2 },
      ],
    });
  }

  return contours;
}

// === HELPERS ===

/** Twice the signed plan (x, z) area of a triangle. */
function getPlanArea(positions: Float32Array, a: number, b: number, c: number): number {
  return (
    (positions[b * 3] - positions[a * 3]) * (positions[c * 3 + 2] - positions[a * 3 + 2]) -
    (positions[b * 3 + 2] - positions[a * 3 + 2]) * (positions[c * 3] - positions[a * 3])
  );
}

/** Shelf ids by grid cell, flattened: cell `i` holds `shelves[starts[i]..starts[i + 1])`. */
function createShelfBuckets(
  positions: Float32Array,
  shelves: readonly number[],
  columns: number,
  toColumn: (x: number) => number,
  toRow: (z: number) => number,
): { starts: Uint32Array; shelves: Uint32Array } {
  const ranges: [number, number, number, number][] = [];
  const starts = new Uint32Array(columns * columns + 1);

  for (let shelf = 0; shelf < shelves.length; shelf += 3) {
    const xs = [0, 1, 2].map((corner) => positions[shelves[shelf + corner] * 3]);
    const zs = [0, 1, 2].map((corner) => positions[shelves[shelf + corner] * 3 + 2]);
    const range: [number, number, number, number] = [
      toColumn(Math.min(...xs)),
      toColumn(Math.max(...xs)),
      toRow(Math.min(...zs)),
      toRow(Math.max(...zs)),
    ];

    ranges.push(range);
    forEachCell(range, columns, (cell) => {
      starts[cell + 1]++;
    });
  }

  for (let cell = 0; cell < columns * columns; cell++) {
    starts[cell + 1] += starts[cell];
  }

  const filled = starts.slice(0, -1);
  const bucketed = new Uint32Array(starts[columns * columns]);

  ranges.forEach((range, shelf) => {
    forEachCell(range, columns, (cell) => {
      bucketed[filled[cell]++] = shelf;
    });
  });

  return { starts, shelves: bucketed };
}

function forEachCell(
  [firstColumn, lastColumn, firstRow, lastRow]: readonly [number, number, number, number],
  columns: number,
  visit: (cell: number) => void,
): void {
  for (let row = firstRow; row <= lastRow; row++) {
    for (let column = firstColumn; column <= lastColumn; column++) {
      visit(row * columns + column);
    }
  }
}

/** Edge tests in plan, accepting points within `tolerance` of an edge so seams never leak. */
function isInsideShelf(
  positions: Float32Array,
  shelves: readonly number[],
  shelf: number,
  x: number,
  z: number,
  tolerance: number,
): boolean {
  const corners = [shelves[shelf], shelves[shelf + 1], shelves[shelf + 2]];
  const orientation = Math.sign(getPlanArea(positions, corners[0], corners[1], corners[2]));

  return corners.every((from, side) => {
    const to = corners[(side + 1) % 3];
    const edgeX = positions[to * 3] - positions[from * 3];
    const edgeZ = positions[to * 3 + 2] - positions[from * 3 + 2];
    const cross = edgeX * (z - positions[from * 3 + 2]) - edgeZ * (x - positions[from * 3]);

    return cross * orientation >= -tolerance * Math.hypot(edgeX, edgeZ);
  });
}
