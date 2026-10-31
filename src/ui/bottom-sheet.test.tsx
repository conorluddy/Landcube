import assert from 'node:assert/strict';
import test from 'node:test';
import { BottomSheet } from './bottom-sheet';
import { renderMarkup } from './test-helpers';

function renderSheet(overrides: Partial<Parameters<typeof BottomSheet>[0]> = {}): string {
  return renderMarkup(
    <BottomSheet
      id="studio-inspector"
      label="Landscape controls"
      snap="half"
      onSnapChange={() => undefined}
      peek={<p>Readouts</p>}
      header={<nav aria-label="Editing section" />}
      {...overrides}
    >
      <p>Body</p>
    </BottomSheet>,
  );
}

void test('BottomSheet is a labelled glass aside by default, so it stays a complementary landmark', () => {
  const markup = renderSheet();

  assert.match(markup, /^<aside id="studio-inspector" class="lc-bottom-sheet lc-glass"/);
  assert.match(markup, /aria-label="Landscape controls"/);
  assert.match(markup, /data-ui-surface="true"/);
});

void test('the handle controls the sheet and reports the snap the sheet carries', () => {
  const markup = renderSheet({ snap: 'peek' });

  assert.match(markup, /data-snap="peek"/);
  assert.match(markup, /aria-controls="studio-inspector"/);
  assert.match(markup, /aria-valuetext="peek"/);
});

void test('peek, header and body render in order under the handle', () => {
  const markup = renderSheet();

  assert.ok(markup.indexOf('lc-sheet-handle') < markup.indexOf('Readouts'));
  assert.ok(markup.indexOf('Readouts') < markup.indexOf('Editing section'));
  assert.ok(markup.indexOf('Editing section') < markup.indexOf('Body'));
});

void test('snap sizes come from props as CSS variables', () => {
  const markup = renderSheet({ peekHeightPx: 160, fullTopInsetPx: 48 });

  assert.match(markup, /--lc-sheet-peek-height:160px/);
  assert.match(markup, /--lc-sheet-full-inset:48px/);
});

void test('without an id the sheet generates one for the handle to control', () => {
  const markup = renderSheet({ id: undefined, as: 'section' });
  const id = /<section id="([^"]+)"/.exec(markup)?.[1] ?? '';

  assert.notEqual(id, '');
  assert.match(markup, new RegExp(`aria-controls="${id}"`));
});

void test('a closed sheet makes its peek, header and body inert; an open one does not', () => {
  const closed = renderSheet({ snap: 'closed' });

  assert.match(closed, /class="lc-bottom-sheet__peek" inert=""/);
  assert.match(closed, /class="lc-bottom-sheet__header" inert=""/);
  assert.match(closed, /class="lc-bottom-sheet__body" inert=""/);
  assert.doesNotMatch(renderSheet({ snap: 'peek' }), /inert/);
});
