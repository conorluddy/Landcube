import assert from 'node:assert/strict';
import test from 'node:test';
import { Button } from './button';
import { renderMarkup } from './test-helpers';

void test('Button defaults to a secondary medium type=button', () => {
  const markup = renderMarkup(<Button>Cancel</Button>);

  assert.match(markup, /type="button"/);
  assert.match(markup, /data-variant="secondary"/);
  assert.match(markup, /data-size="medium"/);
  assert.ok(!markup.includes('disabled'));
  assert.ok(!markup.includes('aria-busy'));
});

void test('Button isBusy sets aria-busy and keeps the label visible', () => {
  const markup = renderMarkup(<Button isBusy>Export</Button>);

  assert.match(markup, /aria-busy="true"/);
  assert.match(markup, />Export</);
});

void test('Button hides the trailing glyph from assistive tech', () => {
  const markup = renderMarkup(<Button trailingGlyph="→">Next</Button>);

  assert.match(markup, /<span class="lc-button__glyph" aria-hidden="true">→<\/span>/);
});

void test('Button passes aria attributes through and marks full width', () => {
  const markup = renderMarkup(
    <Button variant="primary" isFullWidth disabled aria-describedby="hint" aria-expanded={false}>
      Go
    </Button>,
  );

  assert.match(markup, /aria-describedby="hint"/);
  assert.match(markup, /aria-expanded="false"/);
  assert.match(markup, /data-full-width="true"/);
  assert.match(markup, /disabled=""/);
});
