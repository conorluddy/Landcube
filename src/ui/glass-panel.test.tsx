import assert from 'node:assert/strict';
import test from 'node:test';
import { GlassPanel } from './glass-panel';
import { renderMarkup } from './test-helpers';

void test('GlassPanel is a padded glass div marked as a UI surface', () => {
  assert.equal(
    renderMarkup(<GlassPanel>Body</GlassPanel>),
    '<div class="lc-glass-panel lc-glass" data-padding="default" data-ui-surface="true">Body</div>',
  );
});

void test('GlassPanel renders a named aside with the caller class and data hooks', () => {
  const markup = renderMarkup(
    <GlassPanel
      as="aside"
      id="studio-inspector"
      label="Landscape controls"
      padding="none"
      className="lc-inspector"
      dataAttributes={{ 'data-collapsed': 'true' }}
    >
      Body
    </GlassPanel>,
  );

  assert.match(markup, /^<aside data-collapsed="true" id="studio-inspector"/);
  assert.match(markup, /class="lc-glass-panel lc-glass lc-inspector" data-padding="none"/);
  assert.match(markup, /aria-label="Landscape controls"/);
});
