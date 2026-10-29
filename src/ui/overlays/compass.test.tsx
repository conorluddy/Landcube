import assert from 'node:assert/strict';
import test from 'node:test';
import { renderMarkup } from '../test-helpers';
import { Compass } from './compass';

void test('Compass turns its rose against the heading so north stays north', () => {
  const markup = renderMarkup(<Compass headingDegrees={312} />);

  assert.ok(markup.includes('data-azimuth="312"'));
  assert.ok(markup.includes('--lc-compass-rotation:-312deg'));
});

void test('Compass rounds the heading and wraps 360 to north', () => {
  const markup = renderMarkup(<Compass headingDegrees={359.6} />);

  assert.ok(markup.includes('data-azimuth="0"'));
  assert.ok(markup.includes('aria-label="North arrow, view heading 0°"'));
});
