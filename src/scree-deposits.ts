import { smoothstep } from './decoration-field';
import type { HeightField } from './types/terrain';

/**
 * Where fallen rock comes to rest, in [0, 1] on the height field's own grid. Steep ground sheds
 * rock, which runs downhill along the steepest path (so gullies concentrate it) and settles where
 * the slope eases: aprons under cliffs and fans at gully mouths.
 */
export function computeScreeDeposits(
  field: HeightField,
  metersPerFieldUnit: number,
  metersPerFrameUnit: number,
): HeightField {
  const { columns, rows, values } = field;
  const cellCount = columns * rows;
  const slopes = computeSlopeDegrees(field, metersPerFieldUnit, metersPerFrameUnit);
  const carried = new Float64Array(cellCount);
  const settled = new Float64Array(cellCount);
  // Highest first, so every cell has received all its uphill supply before passing it on.
  const order = Uint32Array.from({ length: cellCount }, (_, index) => index).sort(
    (a, b) => values[b] - values[a] || a - b,
  );

  for (const index of order) {
    const slope = slopes[index];
    const supply = carried[index] + smoothstep(30, 48, slope);
    const downhill = getSteepestNeighbour(field, index);
    // Rock keeps rolling on steep ground and drops out as the slope flattens.
    const settling = downhill < 0 ? 1 : 0.04 + 0.5 * (1 - smoothstep(12, 32, slope));

    settled[index] += supply * settling;

    if (downhill >= 0) {
      carried[downhill] += supply * (1 - settling);
    }
  }

  return { ...field, values: softenDeposits(settled, columns, rows) };
}

// === HELPERS ===

/** Real, unexaggerated slope per cell, so exaggeration never moves scree. */
function computeSlopeDegrees(
  field: HeightField,
  metersPerFieldUnit: number,
  metersPerFrameUnit: number,
): Float64Array {
  const { columns, rows, values, spacing } = field;
  const slopes = new Float64Array(columns * rows);

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const left = values[row * columns + Math.max(0, column - 1)];
      const right = values[row * columns + Math.min(columns - 1, column + 1)];
      const up = values[Math.max(0, row - 1) * columns + column];
      const down = values[Math.min(rows - 1, row + 1) * columns + column];
      const rise = Math.hypot(right - left, down - up) * metersPerFieldUnit;
      const run = 2 * spacing * metersPerFrameUnit;

      slopes[row * columns + column] = (Math.atan2(rise, run) * 180) / Math.PI;
    }
  }

  return slopes;
}

/** The lowest of the eight neighbours below this cell, by drop per distance; −1 in a hollow. */
function getSteepestNeighbour(field: HeightField, index: number): number {
  const { columns, rows, values } = field;
  const column = index % columns;
  const row = Math.floor(index / columns);
  let steepest = -1;
  let steepestDrop = 0;

  for (let deltaRow = -1; deltaRow <= 1; deltaRow++) {
    for (let deltaColumn = -1; deltaColumn <= 1; deltaColumn++) {
      const neighbourColumn = column + deltaColumn;
      const neighbourRow = row + deltaRow;

      if (
        (deltaRow === 0 && deltaColumn === 0) ||
        neighbourColumn < 0 ||
        neighbourRow < 0 ||
        neighbourColumn >= columns ||
        neighbourRow >= rows
      ) {
        continue;
      }

      const neighbour = neighbourRow * columns + neighbourColumn;
      const drop = (values[index] - values[neighbour]) / Math.hypot(deltaRow, deltaColumn);

      if (drop > steepestDrop) {
        steepest = neighbour;
        steepestDrop = drop;
      }
    }
  }

  return steepest;
}

/** Rock runs out a few cells past where it lands, so aprons spread and taper into open ground. */
const runoutCells = 3;

/** Blurs twice for a soft taper, then saturates so about one cell of shed rock is a full apron. */
function softenDeposits(settled: Float64Array, columns: number, rows: number): Float64Array {
  let softened = settled;

  for (let pass = 0; pass < 2; pass++) {
    softened = blurAlong(softened, columns, rows, 1, 0);
    softened = blurAlong(softened, columns, rows, 0, 1);
  }

  return softened.map((value) => 1 - Math.exp(-value / 0.15));
}

/** Box blur along one axis, averaging only cells inside the field. */
function blurAlong(
  values: Float64Array,
  columns: number,
  rows: number,
  stepColumn: number,
  stepRow: number,
): Float64Array {
  const blurred = new Float64Array(values.length);

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      let total = 0;
      let count = 0;

      for (let offset = -runoutCells; offset <= runoutCells; offset++) {
        const neighbourColumn = column + offset * stepColumn;
        const neighbourRow = row + offset * stepRow;

        if (
          neighbourColumn >= 0 &&
          neighbourRow >= 0 &&
          neighbourColumn < columns &&
          neighbourRow < rows
        ) {
          total += values[neighbourRow * columns + neighbourColumn];
          count++;
        }
      }

      blurred[row * columns + column] = total / count;
    }
  }

  return blurred;
}
