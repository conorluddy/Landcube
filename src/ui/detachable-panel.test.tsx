import assert from 'node:assert/strict';
import test from 'node:test';
import type { ControlGroupDefinition } from './control-rows';
import { DetachablePanel } from './detachable-panel';
import { LayoutManager } from './layout-manager';
import { renderMarkup } from './test-helpers';

const noop = () => undefined;
const contourDensity: ControlGroupDefinition = {
  id: 'contour-density',
  title: 'Contour density',
  isPinnable: true,
  rows: [{ kind: 'hint', id: 'contour-density-hint', children: 'Lines per height band.' }],
};

function renderPanel(label?: string): string {
  return renderMarkup(
    <DetachablePanel
      group={contourDensity}
      code="CONT.01"
      position={{ xPx: 24, yPx: 72 }}
      zIndex={3}
      label={label}
      onMove={noop}
      onDock={noop}
      onFocus={noop}
    />,
  );
}

void test('a pinned panel is a named dialog on a glass UI surface at its position', () => {
  const markup = renderPanel();

  assert.match(
    markup,
    /^<section class="lc-detachable-panel" role="dialog" aria-label="Contour density \(pinned\)" data-ui-surface="true" data-pinned-group-id="contour-density" style="left:24px;top:72px;z-index:3">/,
  );
  assert.match(markup, /class="lc-glass-panel lc-glass lc-detachable-panel__glass"/);
});

void test('the header is a focusable drag handle with a Dock button', () => {
  const markup = renderPanel();

  assert.match(
    markup,
    /<div class="lc-detachable-panel__handle" role="group" aria-roledescription="drag handle" aria-label="Move Contour density"[^>]*tabindex="0">/,
  );
  assert.match(markup, /aria-label="Dock Contour density"/);
  assert.match(markup, /<span class="lc-group-header__code" aria-hidden="true">CONT.01<\/span>/);
});

void test('the body renders the group rows without a pin button', () => {
  const markup = renderPanel();

  assert.match(markup, /<fieldset class="lc-group" data-group-id="contour-density">/);
  assert.match(markup, /id="contour-density-hint"/);
  assert.doesNotMatch(markup, /Pin Contour density/);
});

void test('a custom label names the dialog', () => {
  assert.match(renderPanel('Density panel'), /aria-label="Density panel"/);
});

void test('the layout manager renders one panel per pinned group', () => {
  const markup = renderMarkup(
    <LayoutManager
      panels={[
        { id: 'contour-density', group: contourDensity, position: { xPx: 24, yPx: 72 }, zIndex: 1 },
        {
          id: 'lens',
          group: { id: 'lens', title: 'Lens', rows: [] },
          position: { xPx: 48, yPx: 96 },
          zIndex: 2,
        },
      ]}
      reservedRightPx={408}
      onMove={noop}
      onDock={noop}
      onRaise={noop}
    />,
  );

  assert.match(markup, /^<div class="lc-layout-manager">/);
  assert.equal(markup.match(/role="dialog"/g)?.length, 2);
  assert.match(markup, /aria-label="Lens \(pinned\)"/);
});
