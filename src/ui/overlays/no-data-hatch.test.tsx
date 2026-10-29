import assert from 'node:assert/strict';
import test from 'node:test';
import { renderMarkup } from '../test-helpers';
import { NoDataHatch } from './no-data-hatch';

void test('NoDataHatch is decorative and labels the region', () => {
  const markup = renderMarkup(<NoDataHatch />);

  assert.match(markup, /^<div class="lc-no-data-hatch" aria-hidden="true">/);
  assert.match(markup, />No data<\/span>/);
});

void test('NoDataHatch takes a custom label', () => {
  assert.match(renderMarkup(<NoDataHatch label="Void" />), />Void<\/span>/);
});
