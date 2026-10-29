import assert from 'node:assert/strict';
import test from 'node:test';
import { renderMarkup } from '../test-helpers';
import { CoordinateTip } from './coordinate-tip';
import { Crosshair } from './crosshair';

void test('a tracking Crosshair publishes its position as CSS custom properties', () => {
  const markup = renderMarkup(<Crosshair position={{ xPx: 120, yPx: 48.5 }} />);

  assert.ok(markup.includes('data-state="tracking"'));
  assert.ok(markup.includes('--lc-crosshair-x:120px;--lc-crosshair-y:48.5px'));
});

void test('a Crosshair without a position is hidden and has no position', () => {
  const markup = renderMarkup(<Crosshair />);

  assert.ok(markup.includes('data-state="hidden"'));
  assert.ok(!markup.includes('--lc-crosshair-x'));
});

void test('the Crosshair hosts its coordinate tip and stays out of the accessibility tree', () => {
  const markup = renderMarkup(
    <Crosshair position={{ xPx: 0, yPx: 0 }}>
      <CoordinateTip lines={['55.0343°N', '8.1130°W']} />
    </Crosshair>,
  );

  assert.ok(markup.includes('aria-hidden="true"'));
  assert.ok(markup.includes('<div class="lc-crosshair__tip"><div class="lc-coordinate-tip">'));
  assert.ok(!markup.includes('data-ui-surface'));
});
