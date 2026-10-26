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
