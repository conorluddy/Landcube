import assert from 'node:assert/strict';
import test from 'node:test';
import { SectionRail, formatSectionIndex, type RailSection } from './section-rail';
import { renderMarkup } from './test-helpers';

const sections: RailSection<string>[] = [
  { id: 'Terrain', index: 1, code: 'TERR', title: 'Terrain' },
  { id: 'Camera', index: 4, code: 'CAMR', title: 'Camera' },
  { id: 'Model', index: 6, code: 'MODL', title: 'Model' },
];

function renderRail(overrides: Partial<Parameters<typeof SectionRail<string>>[0]> = {}): string {
  return renderMarkup(
    <SectionRail
      label="Editing section"
      sections={sections}
      activeSectionId="Camera"
      onSelectSection={() => undefined}
      {...overrides}
    />,
  );
}

void test('SectionRail is a labelled navigation with one button per section', () => {
  const markup = renderRail();

  assert.match(markup, /^<nav class="lc-section-rail" aria-label="Editing section"/);
  assert.equal(markup.match(/<button/g)?.length, 3);
});

void test('rail buttons keep the bare title as text and name, the index and code as data', () => {
  const markup = renderRail();

  assert.match(
    markup,
    /data-index="06" data-code="MODL" aria-label="Model" aria-pressed="false"[^>]*><span class="lc-section-rail__title">Model<\/span><\/button>/,
  );
});

void test('only the active section is pressed and is the single tab stop', () => {
  const markup = renderRail();

  assert.match(markup, /aria-label="Camera" aria-pressed="true" tabindex="0"/);
  assert.equal(markup.match(/tabindex="0"/g)?.length, 1);
});

void test('hidden sections leave the rail but keep the others numbered', () => {
  const markup = renderRail({ hiddenSectionIds: ['Camera'], activeSectionId: 'Terrain' });

  assert.ok(!markup.includes('Camera'));
  assert.match(markup, /data-index="06"/);
});

void test('buttons point at their panels and the orientation is exposed for CSS', () => {
  const markup = renderRail({
    orientation: 'horizontal',
    getPanelId: (id) => `inspector-${id.toLowerCase()}`,
  });

  assert.match(markup, /data-orientation="horizontal"/);
  assert.match(markup, /aria-controls="inspector-model"/);
});

void test('the first visible section takes the tab stop when the active one is hidden', () => {
  const markup = renderRail({ hiddenSectionIds: ['Camera'] });

  assert.match(markup, /aria-label="Terrain" aria-pressed="false" tabindex="0"/);
});

void test('section indexes are two digits', () => {
  assert.equal(formatSectionIndex(4), '04');
  assert.equal(formatSectionIndex(12), '12');
});
