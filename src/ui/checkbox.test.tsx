import assert from 'node:assert/strict';
import test from 'node:test';
import { Checkbox } from './checkbox';
import { renderMarkup } from './test-helpers';

const noop = (): void => undefined;

void test('Checkbox renders a native checkbox associated with its label', () => {
  const markup = renderMarkup(<Checkbox id="plaque" label="Plaque" value onChange={noop} />);

  assert.match(markup, /<label class="lc-checkbox" for="plaque">/);
  assert.match(markup, /<input[^>]*id="plaque"[^>]*type="checkbox"/);
  assert.match(markup, /checked=""/);
});

void test('Checkbox is unchecked when value is false', () => {
  const markup = renderMarkup(<Checkbox label="Plaque" value={false} onChange={noop} />);

  assert.ok(!markup.includes('checked=""'));
});

void test('Checkbox hides the drawn box and shows the detail text', () => {
  const markup = renderMarkup(<Checkbox label="Plaque" detail="1.2 MB" value onChange={noop} />);

  assert.match(markup, /class="lc-checkbox__box" aria-hidden="true"/);
  assert.match(markup, /<span class="lc-checkbox__detail">1\.2 MB<\/span>/);
});

void test('Checkbox omits the detail element when none is given', () => {
  const markup = renderMarkup(<Checkbox label="Plaque" value onChange={noop} />);

  assert.ok(!markup.includes('lc-checkbox__detail'));
});

void test('Checkbox can be disabled', () => {
  const markup = renderMarkup(<Checkbox label="Plaque" value disabled onChange={noop} />);

  assert.match(markup, /disabled=""/);
});
