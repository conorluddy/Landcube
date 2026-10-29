import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { preprocessElevations } from './elevation-preprocessing';

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

      assert.equal(preprocessElevations(grid, 3, 3).repairs['isolated-outliers'], expected);
    }
  }
});
