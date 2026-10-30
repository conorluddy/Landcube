import assert from 'node:assert/strict';
import test from 'node:test';
import { TabBar } from './tab-bar';
import { renderMarkup } from './test-helpers';

const items = [
  { id: 'library', glyph: '▦', label: 'Library' },
  { id: 'studio', glyph: '≋', label: 'Studio' },
  { id: 'account', glyph: '○', label: 'Account' },
] as const;

void test('TabBar is a nav named Pages with one button per item', () => {
  const markup = renderMarkup(
    <TabBar items={items} activeId="studio" onSelect={() => undefined} />,
  );

  assert.match(markup, /^<nav class="lc-tab-bar" aria-label="Pages"/);
  assert.equal(markup.match(/<button/g)?.length, 3);
});

void test('TabBar marks only the active item with aria-current page', () => {
  const markup = renderMarkup(
    <TabBar items={items} activeId="studio" onSelect={() => undefined} />,
  );

  assert.equal(markup.match(/aria-current="page"/g)?.length, 1);
  assert.match(markup, /aria-current="page"[^>]*><span[^>]*>≋<\/span><span[^>]*>Studio/);
});

void test('TabBar hides glyphs from assistive tech so names are the labels', () => {
  const markup = renderMarkup(
    <TabBar items={items} activeId="library" onSelect={() => undefined} />,
  );

  assert.equal(markup.match(/aria-hidden="true"/g)?.length, 3);
});
