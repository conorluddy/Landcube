import assert from 'node:assert/strict';
import test from 'node:test';
import { ReadoutCell, ReadoutGrid } from './readout-grid';
import { renderMarkup } from './test-helpers';

void test('ReadoutGrid is a definition list of label/value pairs', () => {
  const markup = renderMarkup(
    <ReadoutGrid>
      <ReadoutCell label="Elevation" value="412" unit="m" />
    </ReadoutGrid>,
  );

  assert.match(markup, /^<dl class="lc-readout-grid">/);
  assert.match(markup, /<dt class="lc-readout-cell__label">Elevation<\/dt>/);
  assert.match(markup, /412 <span class="lc-readout-cell__unit">m<\/span><\/dd>/);
});

void test('ReadoutCell renders an em dash for empty values and drops the unit', () => {
  for (const value of [undefined, null, ''] as const) {
    const markup = renderMarkup(<ReadoutCell label="Slope" value={value} unit="deg" />);

    assert.match(markup, />—<\/dd>/);
    assert.ok(!markup.includes('deg'));
  }
});

void test('ReadoutCell keeps zero as a real value', () => {
  assert.match(renderMarkup(<ReadoutCell label="Count" value={0} />), />0<\/dd>/);
});

void test('ReadoutCell is tabular by default and can opt out', () => {
  assert.match(renderMarkup(<ReadoutCell label="A" value="1" />), /data-tabular="true"/);
  assert.ok(
    !renderMarkup(<ReadoutCell label="A" value="1" isTabular={false} />).includes('data-tabular'),
  );
});
