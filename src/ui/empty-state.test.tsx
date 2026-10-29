import assert from 'node:assert/strict';
import test from 'node:test';
import { EmptyState } from './empty-state';
import { renderMarkup } from './test-helpers';

void test('EmptyState is a plain section, not a live region', () => {
  const markup = renderMarkup(<EmptyState title="No terrain loaded">Pick a place.</EmptyState>);

  assert.match(markup, /^<section class="lc-empty-state">/);
  assert.ok(!markup.includes('role='));
  assert.ok(!markup.includes('aria-live'));
});

void test('EmptyState hides its glyph from assistive tech and omits unused parts', () => {
  const withGlyph = renderMarkup(<EmptyState glyph="◇" title="Empty" />);

  assert.match(withGlyph, /aria-hidden="true">◇</);
  assert.ok(!withGlyph.includes('lc-empty-state__body'));
  assert.ok(!withGlyph.includes('<button'));
});

void test('EmptyState renders its action as a button', () => {
  const markup = renderMarkup(
    <EmptyState title="Empty" action={{ label: 'Load terrain', onClick: () => undefined }} />,
  );

  assert.match(markup, /<button[^>]*>.*Load terrain/);
});
