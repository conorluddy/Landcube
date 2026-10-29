/** A deterministic rule operates on a complete elevation grid in meters. */
export interface ElevationRule {
  id: string;
  apply(
    values: Float64Array,
    columns: number,
    rows: number,
  ): { values: Float64Array; repaired: number };
}

const outlierDeviationMeters = 500;
const neighborAgreementMeters = 100;
const minimumNeighborCount = 3;

/** Repairs isolated outliers using the available neighbours in the original grid. */
export const isolatedElevationOutliers: ElevationRule = {
  id: 'isolated-outliers',
  apply(values, columns, rows) {
    const output = values.slice();
    let repaired = 0;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        const index = y * columns + x;
        const neighbors: number[] = [];

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;

            if ((dx !== 0 || dy !== 0) && nx >= 0 && nx < columns && ny >= 0 && ny < rows) {
              neighbors.push(values[ny * columns + nx]);
            }
          }
        }

        if (neighbors.length < minimumNeighborCount || !neighbors.every(Number.isFinite)) {
          continue;
        }

        neighbors.sort((a, b) => a - b);
        const middle = Math.floor(neighbors.length / 2);
        const median =
          neighbors.length % 2
            ? neighbors[middle]
            : (neighbors[middle - 1] + neighbors[middle]) / 2;

        if (
          Number.isFinite(values[index]) &&
          Math.abs(values[index] - median) >= outlierDeviationMeters &&
          neighbors.filter((value) => Math.abs(value - median) <= neighborAgreementMeters).length >=
            Math.ceil(neighbors.length * 0.75)
        ) {
          output[index] = median;
          repaired++;
        }
      }
    }

    return { values: output, repaired };
  },
};

/** Runs rules in order and exposes counts for diagnostics. */
export function preprocessElevations(
  values: Float64Array,
  columns: number,
  rows: number,
  rules: readonly ElevationRule[] = [isolatedElevationOutliers],
): { values: Float64Array; repairs: Record<string, number> } {
  if (
    !Number.isInteger(columns) ||
    !Number.isInteger(rows) ||
    columns < 1 ||
    rows < 1 ||
    values.length !== columns * rows
  ) {
    throw new Error(
      'Elevation grid dimensions must be positive integers matching the number of values.',
    );
  }

  if (new Set(rules.map((rule) => rule.id)).size !== rules.length) {
    throw new Error('Elevation preprocessing rule IDs must be unique.');
  }

  let current = values;
  const repairs: Record<string, number> = {};

  for (const rule of rules) {
    const result = rule.apply(current, columns, rows);

    current = result.values;
    repairs[rule.id] = result.repaired;
  }

  return { values: current, repairs };
}
