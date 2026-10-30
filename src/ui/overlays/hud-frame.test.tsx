import assert from 'node:assert/strict';
import test from 'node:test';
import { renderMarkup } from '../test-helpers';
import { HudFrame } from './hud-frame';

void test('HudFrame draws four corner brackets and a tick ruler, hidden from assistive tech', () => {
  const markup = renderMarkup(<HudFrame readouts={['View 2D · Plan']} />);

  assert.match(markup, /^<div class="lc-hud-frame" aria-hidden="true">/);
  assert.equal(markup.match(/lc-hud-frame__corner/g)?.length, 4);
  assert.ok(markup.includes('class="lc-hud-frame__ruler"'));
});

void test('HudFrame lists camera readouts in authoring case, with an optional trailing readout', () => {
  const markup = renderMarkup(
    <HudFrame readouts={['View 3D · Orbit', 'FOV 38°']} trailingReadout="Contour 20 m" />,
  );

  assert.ok(markup.includes('<span>View 3D · Orbit</span><span>FOV 38°</span>'));
  assert.ok(markup.includes('<span class="lc-hud-frame__trailing">Contour 20 m</span>'));
});

void test('HudFrame omits the trailing readout when none is given', () => {
  assert.ok(!renderMarkup(<HudFrame readouts={[]} />).includes('lc-hud-frame__trailing'));
});

void test('HudFrame never carries data-ui-surface, so the cursor keeps deforming beneath it', () => {
  assert.ok(!renderMarkup(<HudFrame readouts={['View 2D · Plan']} />).includes('data-ui-surface'));
});
