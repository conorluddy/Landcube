import assert from 'node:assert/strict';
import test from 'node:test';
import { SuccessSheet, type SuccessRow } from './success-sheet';
import { renderMarkup } from './test-helpers';

const noop = (): void => undefined;
const rows: SuccessRow[] = [
  { glyph: '▤', label: 'Files', detail: 'Saved to your downloads folder.', onClick: noop },
  { glyph: '↗', label: 'Send to printer', onClick: noop, isDisabled: true, tag: 'Soon' },
  { glyph: '⧉', label: 'Copy style link', onClick: noop },
];

void test('SuccessSheet is a named status region with the title as a heading', () => {
  const markup = renderMarkup(<SuccessSheet title="SVG downloaded" rows={rows} onDone={noop} />);

  assert.match(markup, /role="status" aria-label="SVG downloaded"/);
  assert.match(markup, /<h3 class="lc-success-sheet__title">SVG downloaded<\/h3>/);
});

void test('SuccessSheet renders one button per row with its detail', () => {
  const markup = renderMarkup(<SuccessSheet title="Done" rows={rows} onDone={noop} />);

  for (const label of ['Files', 'Send to printer', 'Copy style link']) {
    assert.ok(markup.includes(`>${label}</span>`), label);
  }

  assert.ok(markup.includes('Saved to your downloads folder.'));
  assert.equal(markup.match(/class="lc-success-sheet__row"/g)?.length, 3);
});

void test('SuccessSheet disables a row and tags it', () => {
  const markup = renderMarkup(<SuccessSheet title="Done" rows={rows} onDone={noop} />);

  assert.match(markup, /disabled=""[^>]*><span class="lc-success-sheet__glyph"[^>]*>↗/);
  assert.ok(markup.includes('>Soon</span>'));
});

void test('SuccessSheet always offers Done', () => {
  const markup = renderMarkup(<SuccessSheet title="Done" rows={[]} onDone={noop} />);

  assert.ok(markup.includes('>Done</span>'));
});
