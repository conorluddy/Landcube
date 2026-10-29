import type { Contour, ContourPath, ContourPoint } from './types/contours';
import type { HeightField } from './types/terrain';

const contourVertexTieBreakElevation = 1e-12;

/** Stitches marching-square crossings using shared edge identities. */
export function extractContourAtElevation(field: HeightField, elevation: number): Contour {
  const { columns, rows, values, spacing, originX, originY } = field;
  const points = new Map<number, ContourPoint>();
  const neighbors = new Map<number, number[]>();
  const horizontalEdgeCount = (columns - 1) * rows;
  /** Gives neighboring cells the same horizontal edge identity. */
  const getHorizontalEdgeIdentifier = (x: number, y: number) => y * (columns - 1) + x;
  /** Keeps vertical edge identities separate from horizontal edges. */
  const getVerticalEdgeIdentifier = (x: number, y: number) => horizontalEdgeCount + y * columns + x;
  /** Breaks exact vertex ties consistently to avoid zero-length crossings. */
  const calculateRelativeElevation = (value: number) =>
    value === elevation ? contourVertexTieBreakElevation : value - elevation;

  /** Reuses one interpolated crossing for each shared cell edge. */
  const ensureInterpolatedEdgePoint = (
    id: number,
    x: number,
    y: number,
    edgeDirectionX: number,
    edgeDirectionY: number,
    startElevation: number,
    endElevation: number,
  ) => {
    if (!points.has(id)) {
      const interpolationFraction = startElevation / (startElevation - endElevation);

      points.set(id, {
        x: originX + (x + edgeDirectionX * interpolationFraction) * spacing,
        y: originY + (y + edgeDirectionY * interpolationFraction) * spacing,
      });
    }
  };

  /** Records both directions so paths can be traced from either endpoint. */
  const connectContourEdges = (firstEdgeIdentifier: number, secondEdgeIdentifier: number) => {
    for (const [from, to] of [
      [firstEdgeIdentifier, secondEdgeIdentifier],
      [secondEdgeIdentifier, firstEdgeIdentifier],
    ]) {
      const adjacent = neighbors.get(from);

      if (adjacent) {
        adjacent.push(to);
      } else {
        neighbors.set(from, [to]);
      }
    }
  };

  for (let y = 0; y < rows - 1; y++) {
    for (let x = 0; x < columns - 1; x++) {
      const topLeftElevation = calculateRelativeElevation(values[y * columns + x]);
      const topRightElevation = calculateRelativeElevation(values[y * columns + x + 1]);
      const bottomRightElevation = calculateRelativeElevation(values[(y + 1) * columns + x + 1]);
      const bottomLeftElevation = calculateRelativeElevation(values[(y + 1) * columns + x]);

      if (
        topLeftElevation > 0 === topRightElevation > 0 &&
        topLeftElevation > 0 === bottomRightElevation > 0 &&
        topLeftElevation > 0 === bottomLeftElevation > 0
      ) {
        continue;
      }

      const edgeIds = [
        getHorizontalEdgeIdentifier(x, y),
        getVerticalEdgeIdentifier(x + 1, y),
        getHorizontalEdgeIdentifier(x, y + 1),
        getVerticalEdgeIdentifier(x, y),
      ];
      const crossingEdgeIndices: number[] = [];

      if (topLeftElevation > 0 !== topRightElevation > 0) {
        ensureInterpolatedEdgePoint(edgeIds[0], x, y, 1, 0, topLeftElevation, topRightElevation);
        crossingEdgeIndices.push(0);
      }

      if (topRightElevation > 0 !== bottomRightElevation > 0) {
        ensureInterpolatedEdgePoint(
          edgeIds[1],
          x + 1,
          y,
          0,
          1,
          topRightElevation,
          bottomRightElevation,
        );
        crossingEdgeIndices.push(1);
      }

      if (bottomLeftElevation > 0 !== bottomRightElevation > 0) {
        ensureInterpolatedEdgePoint(
          edgeIds[2],
          x,
          y + 1,
          1,
          0,
          bottomLeftElevation,
          bottomRightElevation,
        );
        crossingEdgeIndices.push(2);
      }

      if (topLeftElevation > 0 !== bottomLeftElevation > 0) {
        ensureInterpolatedEdgePoint(edgeIds[3], x, y, 0, 1, topLeftElevation, bottomLeftElevation);
        crossingEdgeIndices.push(3);
      }

      if (crossingEdgeIndices.length === 2) {
        connectContourEdges(edgeIds[crossingEdgeIndices[0]], edgeIds[crossingEdgeIndices[1]]);
      }

      if (crossingEdgeIndices.length === 4) {
        // Asymptotic decider: determinant chooses the bilinear saddle's topology.
        // At an exact saddle, use the same deterministic diagonal everywhere.
        const pairs =
          topLeftElevation * bottomRightElevation - topRightElevation * bottomLeftElevation >= 0
            ? [
                [0, 1],
                [2, 3],
              ]
            : [
                [0, 3],
                [1, 2],
              ];

        for (const [first, second] of pairs) {
          connectContourEdges(edgeIds[first], edgeIds[second]);
        }
      }
    }
  }

  const visitedEdgeIdentifiers = new Set<number>();
  const paths: ContourPath[] = [];

  /** Consumes an unvisited chain or loop without repeating joining vertices. */
  const traceContourPath = (start: number) => {
    const path: ContourPoint[] = [];
    let current = start;
    let previous = -1;

    while (!visitedEdgeIdentifiers.has(current)) {
      visitedEdgeIdentifiers.add(current);
      const point = points.get(current);
      const adjacentEdges = neighbors.get(current);

      if (point === undefined || adjacentEdges === undefined) {
        throw new Error(
          `Contour edge ${current.toString()} has incomplete geometry. Check edge stitching.`,
        );
      }

      path.push(point);
      const next = adjacentEdges.find((id) => id !== previous);

      if (next === undefined) {
        break;
      }

      previous = current;
      current = next;
    }

    paths.push({ points: path, closed: current === start && path.length > 2 });
  };

  // Start boundary-to-boundary paths first, then collect the remaining closed loops.
  for (const [id, adjacent] of neighbors) {
    if (adjacent.length === 1 && !visitedEdgeIdentifiers.has(id)) {
      traceContourPath(id);
    }
  }

  for (const id of neighbors.keys()) {
    if (!visitedEdgeIdentifiers.has(id)) {
      traceContourPath(id);
    }
  }

  return { elevation, paths };
}

/** Extracts each requested elevation from the same sampled field. */
export function extractContours(field: HeightField, levels: readonly number[]): Contour[] {
  return levels.map((level) => extractContourAtElevation(field, level));
}

/**
 * Ramer–Douglas–Peucker simplification: drops points within `tolerance` of the kept outline.
 * Closed paths keep their first point and never collapse below a triangle.
 */
export function simplifyContours(contours: readonly Contour[], tolerance: number): Contour[] {
  return contours.map((contour) => ({
    ...contour,
    paths: contour.paths.map((path) => ({
      ...path,
      points: simplifyContourPoints(path.points, path.closed, tolerance),
    })),
  }));
}

function simplifyContourPoints(
  points: readonly ContourPoint[],
  closed: boolean,
  tolerance: number,
): ContourPoint[] {
  // A closed loop returns to its first point, so simplify it as an open path ending there.
  const outline = closed ? [...points, points[0]] : points;
  const last = outline.length - 1;

  if (last < 2) {
    return [...points];
  }

  const kept = new Uint8Array(outline.length);
  const pending: [number, number][] = [[0, last]];

  kept[0] = kept[last] = 1;

  // An explicit stack keeps long country-scale coastlines from overflowing recursion.
  while (pending.length > 0) {
    const [start, end] = pending.pop() ?? [0, 0];
    let farthest = -1;
    let farthestDistance = tolerance;

    for (let index = start + 1; index < end; index++) {
      const distance = getSegmentDistance(outline[index], outline[start], outline[end]);

      if (distance > farthestDistance) {
        farthest = index;
        farthestDistance = distance;
      }
    }

    if (farthest !== -1) {
      kept[farthest] = 1;
      pending.push([start, farthest], [farthest, end]);
    }
  }

  const simplified = outline.filter((_, index) => kept[index] === 1);

  if (!closed) {
    return simplified;
  }

  simplified.pop();

  return simplified.length >= 3 ? simplified : [...points];
}

function getSegmentDistance(point: ContourPoint, start: ContourPoint, end: ContourPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
        );

  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}
