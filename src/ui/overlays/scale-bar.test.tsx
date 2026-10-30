import assert from 'node:assert/strict';
import test from 'node:test';
import { renderMarkup } from '../test-helpers';
import { ScaleBar } from './scale-bar';

void test('ScaleBar labels zero, the midpoint and the total in kilometres', () => {
  const markup = renderMarkup(<ScaleBar totalKm={2} lengthPx={248} />);

  assert.ok(markup.includes('<span>0</span><span>1</span><span>2 km</span>'));
});

void test('ScaleBar sizes itself from its pixel length', () => {
  assert.ok(
    renderMarkup(<ScaleBar totalKm={2} lengthPx={248} />).includes(
      'style="--lc-scale-bar-length:248px"',
    ),
  );
});

void test('ScaleBar is an image named by its total distance', () => {
  const markup = renderMarkup(<ScaleBar totalKm={0.5} lengthPx={100} />);

  assert.ok(markup.includes('role="img" aria-label="Scale bar, 0.5 km"'));
  assert.ok(markup.includes('<span>0.25</span>'));
});
