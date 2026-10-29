import assert from 'node:assert/strict';
import test from 'node:test';
import { renderMarkup } from '../test-helpers';
import { CoordinateTip } from './coordinate-tip';

void test('CoordinateTip renders one line per coordinate', () => {
  assert.equal(
    renderMarkup(<CoordinateTip lines={['55.0343°N', '8.1130°W']} />),
    '<div class="lc-coordinate-tip"><span>55.0343°N</span><span>8.1130°W</span></div>',
  );
});

void test('CoordinateTip shows an em dash when there is no location', () => {
  assert.ok(renderMarkup(<CoordinateTip lines={[]} />).includes('<span>—</span>'));
});

void test('CoordinateTip is glass-looking but never a UI surface', () => {
  assert.ok(!renderMarkup(<CoordinateTip lines={['E 10 m']} />).includes('data-ui-surface'));
});
