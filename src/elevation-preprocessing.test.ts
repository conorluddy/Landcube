import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { isolatedElevationOutliers, preprocessElevations } from './elevation-preprocessing';
import { createSeededRandomGenerator } from './terrain-generation';

void test('repairs isolated positive and negative outliers without mutating input', () => {
  for (const height of [1832, -834]) {
    const input = Float64Array.from([5, 9, 8, 5, height, 5, 4, -1, 7]);
    const result = preprocessElevations(input, 3, 3);

    assert.equal(result.values[4], 5);
    assert.equal(input[4], height);
    assert.equal(result.repairs['isolated-outliers'], 1);
  }
});

void test('preserves a cliff with high ground on one side', () => {
  const input = Float64Array.from([0, 0, 0, 0, 1000, 1000, 0, 1000, 1000]);

  assert.deepEqual(preprocessElevations(input, 3, 3).values, input);
  assert.equal(preprocessElevations(input, 3, 3).repairs['isolated-outliers'], 0);
});

void test('repairs isolated edge and corner pixels using available neighbours', () => {
  for (const index of [0, 1, 4]) {
    const grid = new Float64Array(9);

    grid[index] = 1000;
    assert.equal(preprocessElevations(grid, 3, 3).values[index], 0);
  }
});

void test('uses pixels across tile boundaries in an assembled grid', () => {
  const grid = new Float64Array(512 * 3);

  grid[512 + 255] = 1832;
  grid[512 + 256] = 1200;
  const result = preprocessElevations(grid, 512, 3);

  assert.equal(result.values[512 + 255], 0);
  assert.equal(result.values[512 + 256], 0);
});

void test('checks the threshold and skips non-finite neighbours', () => {
  for (const [center, expected] of [
    [499, 0],
    [500, 1],
  ]) {
    const input = new Float64Array(9);

    input[4] = center;
    assert.equal(preprocessElevations(input, 3, 3).repairs['isolated-outliers'], expected);
  }

  const input = Float64Array.from([0, 0, 0, 0, 1832, 0, 0, 0, NaN]);

  assert.equal(preprocessElevations(input, 3, 3).repairs['isolated-outliers'], 0);
});

void test('rejects invalid grids and duplicate rule identifiers', () => {
  assert.throws(() => preprocessElevations(new Float64Array(8), 3, 3), /dimensions/);
  const rule = { id: 'duplicate', apply: (values: Float64Array) => ({ values, repaired: 0 }) };

  assert.throws(() => preprocessElevations(new Float64Array(9), 3, 3, [rule, rule]), /unique/);
});

void test('applies the threshold to recorded Aran values with synthetic diagonal neighbours', () => {
  const fixture = JSON.parse(
    readFileSync(
      new URL('../tests/fixtures/aran-elevation-anomalies.json', import.meta.url),
      'utf8',
    ),
  ) as {
    observations: {
      zoom8: { center: number; neighbors: number[] };
      zoom9: { center: number; neighbors: number[] };
    }[];
  };

  for (const observation of fixture.observations) {
    for (const [sample, expected] of [
      [observation.zoom8, 1],
      [observation.zoom9, 0],
    ] as const) {
      const [west, east, north, south] = sample.neighbors;
      const grid = Float64Array.from([0, north, 0, west, sample.center, east, 0, south, 0]);

      const result = preprocessElevations(grid, 3, 3);

      assert.equal(result.values[4] !== sample.center, expected === 1);
    }
  }
});

void test('matches a sort-per-cell reference on a seeded grid with spikes and gaps', () => {
  const columns = 41;
  const rows = 37;
  const random = createSeededRandomGenerator(79);
  const values = Float64Array.from({ length: columns * rows }, () => {
    const roll = random();

    if (roll < 0.01) {
      return Number.NaN;
    }

    return roll < 0.08 ? (random() - 0.5) * 4000 : random() * 120;
  });

  const result = isolatedElevationOutliers.apply(values, columns, rows);

  assert.ok(result.repaired > 20, `only ${result.repaired.toString()} repairs exercised`);
  assert.deepEqual(result.values, referenceOutlierRepair(values, columns, rows));
});

/** The original rule, written plainly: collect, sort, take the median. */
function referenceOutlierRepair(values: Float64Array, columns: number, rows: number) {
  const output = values.slice();

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
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

      if (neighbors.length < 3 || !neighbors.every(Number.isFinite)) {
        continue;
      }

      neighbors.sort((a, b) => a - b);
      const middle = Math.floor(neighbors.length / 2);
      const median =
        neighbors.length % 2 ? neighbors[middle] : (neighbors[middle - 1] + neighbors[middle]) / 2;
      const value = values[y * columns + x];

      if (
        Number.isFinite(value) &&
        Math.abs(value - median) >= 500 &&
        neighbors.filter((neighbor) => Math.abs(neighbor - median) <= 100).length >=
          Math.ceil(neighbors.length * 0.75)
      ) {
        output[y * columns + x] = median;
      }
    }
  }

  return output;
}
