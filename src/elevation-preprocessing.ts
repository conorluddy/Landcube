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
const minimumAgreeingNeighbors = 6;

/** Repairs isolated outliers using the original grid; border cells need a halo. */
export const isolatedElevationOutliers: ElevationRule = {
  id: 'isolated-outliers',
  apply(values, columns, rows) {
    const output = values.slice();
    let repaired = 0;

    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < columns - 1; x++) {
        const index = y * columns + x;
        const neighbors = [
          values[index - columns - 1],
          values[index - columns],
          values[index - columns + 1],
          values[index - 1],
          values[index + 1],
          values[index + columns - 1],
          values[index + columns],
          values[index + columns + 1],
        ].sort((a, b) => a - b);
        const median = (neighbors[3] + neighbors[4]) / 2;

        if (
          Number.isFinite(values[index]) &&
          neighbors.every(Number.isFinite) &&
          Math.abs(values[index] - median) >= outlierDeviationMeters &&
          neighbors.filter((value) => Math.abs(value - median) <= neighborAgreementMeters).length >=
            minimumAgreeingNeighbors
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
