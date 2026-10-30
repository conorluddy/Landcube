import assert from 'node:assert/strict';
import test from 'node:test';
import { InspectorPanel, getInspectorSectionId } from './inspector-panel';
import type { RailSection } from './section-rail';
import { renderMarkup } from './test-helpers';

const sections: RailSection<string>[] = [
  { id: 'Terrain', index: 1, code: 'TERR', title: 'Terrain' },
  { id: 'Contours', index: 2, code: 'CONT', title: 'Contours' },
  { id: 'Model', index: 6, code: 'MODL', title: 'Model' },
];

function renderInspector(
  overrides: Partial<Parameters<typeof InspectorPanel<string>>[0]> = {},
): string {
  return renderMarkup(
    <InspectorPanel
      id="studio-inspector"
      label="Landscape controls"
      railLabel="Editing section"
      sections={sections}
      activeSectionId="Contours"
      onSelectSection={() => undefined}
      isCollapsed={false}
      renderSection={(id) => <p>Body of {id}</p>}
      {...overrides}
    />,
  );
}

void test('InspectorPanel is the labelled glass aside the studio and e2e tests bind to', () => {
  const markup = renderInspector();

  assert.match(markup, /^<aside data-collapsed="false" data-rail-orientation="vertical"/);
  assert.match(markup, /id="studio-inspector"/);
  assert.match(markup, /aria-label="Landscape controls"/);
  assert.match(markup, /data-ui-surface="true"/);
});

void test('every section renders as a labelled region, only the active one visible', () => {
  const markup = renderInspector();

  assert.match(
    markup,
    /<section id="inspector-terrain"[^>]*aria-label="Terrain settings" hidden="">/,
  );
  assert.match(markup, /<section id="inspector-contours"[^>]*aria-label="Contours settings">/);
  assert.match(markup, /Body of Model/);
});

void test('the header shows the active index over the section count, title and tag', () => {
  const markup = renderInspector({ headerTag: 'Src · Real' });

  assert.match(markup, /02 \/ 03<\/span>/);
  assert.match(markup, /<h2 class="lc-inspector__title">Contours<\/h2>/);
  assert.match(markup, />Src · Real<\/span>/);
});

void test('collapsing hides the panel body and keeps the rail', () => {
  const markup = renderInspector({ isCollapsed: true });

  assert.match(markup, /data-collapsed="true"/);
  assert.match(markup, /<nav class="lc-section-rail"/);
  assert.match(markup, /<div class="lc-inspector__panel" hidden="">/);
});

void test('hidden sections leave the rail and stay hidden even when active', () => {
  const markup = renderInspector({ hiddenSectionIds: ['Model'], activeSectionId: 'Model' });

  assert.ok(!markup.includes('aria-label="Model"'));
  assert.match(markup, /<section id="inspector-model"[^>]*hidden="">/);
});

void test('section ids lower-case the registry id', () => {
  assert.equal(getInspectorSectionId('Model'), 'inspector-model');
});
