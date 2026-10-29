import { strict as assert } from 'node:assert';
import { test } from 'node:test';
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
  const input = Float64Array.from([0, 1000, 1000, 0, 1000, 1000, 0, 1000, 1000]);
  assert.deepEqual(preprocessElevations(input, 3, 3).values, input);
});
