/** A deterministic rule operates on a complete elevation grid in meters. */
export interface ElevationRule {
  id: string;
  apply(
    values: Float64Array,
    columns: number,
    rows: number,
  ): { values: Float64Array; repaired: number };
}

export const elevationPipelineVersion = 1;

/** Repairs isolated outliers without changing cliff edges or reading prior repairs. */
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
          Math.abs(values[index] - median) >= 500 &&
          neighbors.filter((value) => Math.abs(value - median) <= 100).length >= 6
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
) {
  let current = values;
  const repairs: Record<string, number> = {};
  for (const rule of rules) {
    const result = rule.apply(current, columns, rows);
    current = result.values;
    repairs[rule.id] = result.repaired;
  }
  return { values: current, repairs };
}
