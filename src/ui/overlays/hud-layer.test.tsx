import assert from 'node:assert/strict';
import test from 'node:test';
import { renderMarkup } from '../test-helpers';
import { HudLayer } from './hud-layer';

void test('HudLayer exposes data-hud with the canvas tone and inspector state', () => {
  const markup = renderMarkup(<HudLayer canvasTone="light" inspectorState="collapsed" />);

  assert.equal(
    markup,
    '<div class="lc-hud-layer" data-hud="true" data-canvas-tone="light" data-inspector="collapsed"></div>',
  );
});

void test('HudLayer wraps each slot in its positioned box and leaves the pointer slot bare', () => {
  const markup = renderMarkup(
    <HudLayer
      canvasTone="dark"
      inspectorState="expanded"
      pointer={<i>pointer</i>}
      frame={<i>frame</i>}
      instruments={<i>instruments</i>}
      readout={<i>readout</i>}
    />,
  );

  assert.ok(markup.includes('"><i>pointer</i><div class="lc-hud-layer__frame">'));
  assert.ok(markup.includes('<div class="lc-hud-layer__instruments"><i>instruments</i></div>'));
  assert.ok(markup.includes('<div class="lc-hud-layer__readout"><i>readout</i></div>'));
});

void test('HudLayer is never a UI surface itself', () => {
  assert.ok(
    !renderMarkup(<HudLayer canvasTone="dark" inspectorState="expanded" />).includes(
      'data-ui-surface',
    ),
  );
});

void test('HudLayer puts tool overlays in their own full-bleed box after the pointer slot', () => {
  const markup = renderMarkup(
    <HudLayer
      canvasTone="dark"
      inspectorState="expanded"
      pointer={<i>pointer</i>}
      tools={<i>tools</i>}
    />,
  );

  assert.ok(markup.includes('<i>pointer</i><div class="lc-hud-layer__tools"><i>tools</i></div>'));
});
