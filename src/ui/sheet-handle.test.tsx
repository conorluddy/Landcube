import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveNextSnap, SheetHandle } from './sheet-handle';
import { renderMarkup } from './test-helpers';

void test('SheetHandle is a labelled button that controls the sheet and reports its snap', () => {
  const markup = renderMarkup(
    <SheetHandle snap="half" controlsId="sheet" onSnapChange={() => undefined} />,
  );

  assert.match(markup, /type="button"/);
  assert.match(markup, /aria-label="Resize sheet"/);
  assert.match(markup, /aria-controls="sheet"/);
  assert.match(markup, /aria-valuetext="half"/);
});

void test('SheetHandle accepts a custom label and draws a decorative grabber', () => {
  const markup = renderMarkup(
    <SheetHandle label="Resize panel" snap="peek" controlsId="p" onSnapChange={() => undefined} />,
  );

  assert.match(markup, /aria-label="Resize panel"/);
  assert.match(markup, /lc-sheet-handle__grabber" aria-hidden="true"/);
});

void test('keys step through closed, peek, half and full', () => {
  assert.equal(resolveNextSnap('peek', 'ArrowDown'), 'closed');
  assert.equal(resolveNextSnap('closed', 'ArrowDown'), 'closed');
  assert.equal(resolveNextSnap('closed', 'ArrowUp'), 'peek');
  assert.equal(resolveNextSnap('half', 'Escape'), 'peek');
  assert.equal(resolveNextSnap('peek', 'Escape'), 'closed');
  assert.equal(resolveNextSnap('closed', 'Escape'), 'closed');
  assert.equal(resolveNextSnap('closed', 'Enter'), 'peek');
  assert.equal(resolveNextSnap('half', 'Enter'), 'full');
  assert.equal(resolveNextSnap('closed', 'Tab'), undefined);
});

void test('SheetHandle reports whether the sheet is expanded', () => {
  const render = (snap: 'closed' | 'peek') =>
    renderMarkup(<SheetHandle snap={snap} controlsId="s" onSnapChange={() => undefined} />);

  assert.match(render('closed'), /aria-expanded="false"/);
  assert.match(render('peek'), /aria-expanded="true"/);
});
