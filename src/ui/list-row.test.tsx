import assert from 'node:assert/strict';
import test from 'node:test';
import { ListRow } from './list-row';
import { renderMarkup } from './test-helpers';

void test('ListRow with onClick renders a button with a chevron', () => {
  const markup = renderMarkup(<ListRow title="Theme" onClick={() => undefined} />);

  assert.match(markup, /^<button class="lc-list-row" type="button">/);
  assert.match(markup, /lc-list-row__chevron/);
});

void test('ListRow with href renders an anchor and wins over onClick', () => {
  const markup = renderMarkup(
    <ListRow title="Source" href="https://example.test/" onClick={() => undefined} />,
  );

  assert.match(markup, /^<a class="lc-list-row" href="https:\/\/example.test\/">/);
});

void test('ListRow without actions is a static div with no chevron', () => {
  const markup = renderMarkup(<ListRow title="Version" meta="0.2.0" />);

  assert.match(markup, /^<div class="lc-list-row">/);
  assert.ok(!markup.includes('lc-list-row__chevron'));
  assert.match(markup, />0\.2\.0</);
});

void test('ListRow renders an empty meta as an em dash and hides the leading tile', () => {
  const markup = renderMarkup(<ListRow title="Units" meta="" leading="◧" />);

  assert.match(markup, /lc-list-row__meta">—</);
  assert.match(markup, /lc-list-row__leading" aria-hidden="true">◧</);
});

void test('ListRow trailing replaces meta and chevron', () => {
  const markup = renderMarkup(
    <ListRow title="Row" meta="x" trailing={<b>T</b>} onClick={() => undefined} />,
  );

  assert.ok(markup.includes('<b>T</b>'));
  assert.ok(!markup.includes('lc-list-row__meta'));
  assert.ok(!markup.includes('lc-list-row__chevron'));
});
