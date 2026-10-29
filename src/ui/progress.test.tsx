import assert from 'node:assert/strict';
import test from 'node:test';
import { Progress } from './progress';
import { renderMarkup } from './test-helpers';

void test('Progress is a named progressbar with 0..1 bounds and the current value', () => {
  const markup = renderMarkup(<Progress fraction={0.4} label="Export" />);

  assert.match(markup, /role="progressbar"/);
  assert.match(markup, /aria-label="Export"/);
  assert.match(markup, /aria-valuemin="0"/);
  assert.match(markup, /aria-valuemax="1"/);
  assert.match(markup, /aria-valuenow="0.4"/);
});

void test('Progress clamps out-of-range fractions', () => {
  assert.match(renderMarkup(<Progress fraction={3} label="x" />), /aria-valuenow="1"/);
  assert.match(renderMarkup(<Progress fraction={-2} label="x" />), /aria-valuenow="0"/);
});

void test('Progress treats NaN as zero', () => {
  assert.match(renderMarkup(<Progress fraction={Number.NaN} label="x" />), /aria-valuenow="0"/);
});

void test('Progress indeterminate omits aria-valuenow', () => {
  const markup = renderMarkup(<Progress fraction={0.5} label="Loading" isIndeterminate />);

  assert.ok(!markup.includes('aria-valuenow'));
  assert.match(markup, /data-indeterminate="true"/);
});
