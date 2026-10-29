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
    // One reused buffer instead of a sorted array per cell keeps country-scale grids fast.
    const neighbors = new Float64Array(8);
    let repaired = 0;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        const index = y * columns + x;
        let count = 0;
        let allFinite = true;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;

            if ((dx !== 0 || dy !== 0) && nx >= 0 && nx < columns && ny >= 0 && ny < rows) {
              const neighbor = values[ny * columns + nx];

              allFinite &&= Number.isFinite(neighbor);
              // Insertion keeps the buffer sorted, matching an ascending sort of the neighbours.
              let slot = count++;

              while (slot > 0 && neighbors[slot - 1] > neighbor) {
                neighbors[slot] = neighbors[slot - 1];
                slot--;
              }

              neighbors[slot] = neighbor;
            }
          }
        }

        if (count < minimumNeighborCount || !allFinite) {
          continue;
        }

        const middle = Math.floor(count / 2);
        const median =
          count % 2 ? neighbors[middle] : (neighbors[middle - 1] + neighbors[middle]) / 2;

        if (
          !Number.isFinite(values[index]) ||
          Math.abs(values[index] - median) < outlierDeviationMeters
        ) {
          continue;
        }

        let agreeing = 0;

        for (let slot = 0; slot < count; slot++) {
          if (Math.abs(neighbors[slot] - median) <= neighborAgreementMeters) {
            agreeing++;
          }
        }

        if (agreeing >= Math.ceil(count * 0.75)) {
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
