import assert from 'node:assert/strict';
import test from 'node:test';
import { IconButton } from './icon-button';
import { renderMarkup } from './test-helpers';

void test('IconButton exposes its label as the accessible name and hides the glyph', () => {
  const markup = renderMarkup(<IconButton glyph="⌖" label="Locate me" onClick={() => undefined} />);

  assert.match(markup, /aria-label="Locate me"/);
  assert.match(markup, /<span class="lc-icon-button__glyph" aria-hidden="true">⌖<\/span>/);
  assert.match(markup, /type="button"/);
});

void test('IconButton is a glass surface', () => {
  const markup = renderMarkup(<IconButton glyph="+" label="Zoom in" onClick={() => undefined} />);

  assert.match(markup, /class="lc-icon-button lc-glass"/);
  assert.match(markup, /data-ui-surface/);
});

void test('IconButton omits aria-pressed unless isActive is given', () => {
  const plain = renderMarkup(<IconButton glyph="+" label="Zoom in" onClick={() => undefined} />);
  const active = renderMarkup(
    <IconButton glyph="◧" label="Layers" isActive onClick={() => undefined} />,
  );
  const inactive = renderMarkup(
    <IconButton glyph="◧" label="Layers" isActive={false} onClick={() => undefined} />,
  );

  assert.ok(!plain.includes('aria-pressed'));
  assert.match(active, /aria-pressed="true"/);
  assert.match(inactive, /aria-pressed="false"/);
});

void test('IconButton renders disabled', () => {
  const markup = renderMarkup(
    <IconButton glyph="+" label="Zoom in" disabled onClick={() => undefined} />,
  );

  assert.match(markup, /disabled=""/);
});

void test('IconButton announces a popover it opens and whether it is open', () => {
  const plain = renderMarkup(<IconButton glyph="◫" label="Overlays" onClick={() => undefined} />);
  const open = renderMarkup(
    <IconButton
      glyph="◫"
      label="Overlays"
      hasPopup="dialog"
      isExpanded
      onClick={() => undefined}
    />,
  );

  assert.ok(!plain.includes('aria-haspopup') && !plain.includes('aria-expanded'));
  assert.match(open, /aria-haspopup="dialog"/);
  assert.match(open, /aria-expanded="true"/);
});
