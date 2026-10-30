import assert from 'node:assert/strict';
import test from 'node:test';
import { SearchField, searchFieldInputClassName } from './search-field';
import { renderMarkup } from './test-helpers';

const input = <input className={searchFieldInputClassName} role="combobox" />;

void test('SearchField keeps the caller className for external selectors', () => {
  const markup = renderMarkup(
    <SearchField
      className="header-place-search"
      label="Search"
      input={input}
      popover={null}
      isOpen={false}
    />,
  );

  assert.match(markup, /^<div class="lc-search-field header-place-search"/);
});

void test('SearchField renders the LOC prefix by default and a custom one on request', () => {
  const base = { label: 'Search', input, popover: null, isOpen: false };

  assert.match(renderMarkup(<SearchField {...base} />), />LOC<\/span>/);
  assert.match(renderMarkup(<SearchField {...base} prefixLabel="GO" />), />GO<\/span>/);
});

void test('SearchField renders one kbd per hint key, hidden from assistive tech', () => {
  const markup = renderMarkup(
    <SearchField
      label="Search"
      input={input}
      popover={null}
      isOpen={false}
      keyboardHint={['⌘', 'K']}
    />,
  );

  assert.equal(markup.match(/<kbd /g)?.length, 2);
  assert.match(markup, /<span class="lc-search-field__hint" aria-hidden="true">/);
});

void test('SearchField omits the hint and status line when not given', () => {
  const markup = renderMarkup(
    <SearchField label="Search" input={input} popover={null} isOpen={false} />,
  );

  assert.doesNotMatch(markup, /<kbd|lc-search-field__status/);
});

void test('SearchField wraps the input in a label named by the label prop', () => {
  const markup = renderMarkup(
    <SearchField label="Search places" input={input} popover={null} isOpen={false} />,
  );

  assert.match(markup, /<label[^>]*><span class="lc-search-field__label">Search places<\/span>/);
  assert.match(markup, /<\/label>/);
});

void test('SearchField exposes size and open state as data attributes', () => {
  const markup = renderMarkup(
    <SearchField
      label="Search"
      input={input}
      popover={<ul />}
      isOpen
      size="mobile"
      statusLine={<p role="status">Data</p>}
    />,
  );

  assert.match(markup, /data-size="mobile" data-open="true"/);
  assert.match(markup, /<ul><\/ul>/);
  assert.match(markup, /<p role="status">Data<\/p>/);
});
