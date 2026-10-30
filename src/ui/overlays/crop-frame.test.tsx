import assert from 'node:assert/strict';
import test from 'node:test';
import { renderMarkup } from '../test-helpers';
import { CropFrame, type CropFrameProps } from './crop-frame';

const props: CropFrameProps = {
  shape: 'rectangle',
  planeAspectRatio: 1.6,
  selection: { x: 0.25, y: 0.1, width: 0.5, height: 0.8 },
  dimensionLabel: '150 × 150 mm · 80%',
  onDragStart: () => undefined,
  onDrag: () => undefined,
  onHandleKey: () => false,
};

void test('CropFrame places the selection from plane fractions and fits the plane ratio', () => {
  const markup = renderMarkup(<CropFrame {...props} />);

  assert.ok(
    markup.includes(
      'style="--lc-crop-plane-ratio:1.6;--lc-crop-x:25%;--lc-crop-y:10%;--lc-crop-width:50%;--lc-crop-height:80%"',
    ),
  );
  assert.ok(markup.includes('<span class="lc-crop-frame__label">150 × 150 mm · 80%</span>'));
});

void test('CropFrame has eight named slider handles valued by their edge position', () => {
  const markup = renderMarkup(<CropFrame {...props} />);

  assert.equal(markup.match(/role="slider"/g)?.length, 8);
  assert.ok(
    markup.includes(
      'data-handle="right" role="slider" aria-label="Crop right edge" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="100" aria-valuenow="75" aria-valuetext="75%"',
    ),
  );
  assert.ok(markup.includes('aria-label="Crop top edge" aria-orientation="vertical"'));
  assert.ok(markup.includes('aria-valuetext="25% across, 90% down"'));
});

void test('CropFrame marks a circle crop by shape and is never a UI surface', () => {
  const markup = renderMarkup(<CropFrame {...props} shape="circle" />);

  assert.ok(markup.startsWith('<div class="lc-crop-frame" data-shape="circle"'));
  assert.ok(!markup.includes('data-ui-surface'));
});
