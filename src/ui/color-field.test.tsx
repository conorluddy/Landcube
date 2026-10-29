import assert from 'node:assert/strict';
import test from 'node:test';
import { ColorField } from './color-field';
import { renderMarkup } from './test-helpers';

const noop = (): void => undefined;

void test('ColorField shows the hex uppercase and hides it from assistive tech', () => {
  const markup = renderMarkup(<ColorField label="Canvas color" value="#20a3ff" onChange={noop} />);

  assert.match(markup, /<span class="lc-color-field__hex" aria-hidden="true">#20A3FF<\/span>/);
  assert.match(markup, /<input[^>]*value="#20a3ff"/);
});

void test('ColorField label targets the colour input by explicit id', () => {
  const markup = renderMarkup(
    <ColorField id="canvasColor" label="Canvas color" value="#202326" onChange={noop} />,
  );

  assert.match(markup, /<label[^>]*for="canvasColor"[^>]*>Canvas color<\/label>/);
  assert.match(markup, /<input[^>]*id="canvasColor"[^>]*type="color"/);
});

void test('ColorField label targets the colour input by generated id', () => {
  const markup = renderMarkup(<ColorField label="Line" value="#202326" onChange={noop} />);
  const labelFor = /<label[^>]*for="([^"]+)"/.exec(markup)?.[1];

  assert.notEqual(labelFor, undefined);
  assert.match(markup, new RegExp(`<input[^>]*id="${labelFor}"`));
});

void test('ColorField paints the swatch with the value and honours disabled', () => {
  const markup = renderMarkup(<ColorField label="Line" value="#202326" disabled onChange={noop} />);

  assert.match(markup, /style="background-color:#202326"/);
  assert.match(markup, /<input[^>]*disabled=""/);
});
