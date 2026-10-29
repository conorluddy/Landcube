import assert from 'node:assert/strict';
import test from 'node:test';
import { SheetHandle } from './sheet-handle';
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
