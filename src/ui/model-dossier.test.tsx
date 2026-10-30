import assert from 'node:assert/strict';
import test from 'node:test';
import { ModelDossier, type ModelDossierView } from './model-dossier';
import {
  createModelDossierFixture,
  createProceduralDossierFixture,
  createRealDossierFixture,
  dossierTerrainAttribution,
} from './model-dossier.fixtures';
import { renderMarkup } from './test-helpers';

const noop = (): void => undefined;

function render(model: ModelDossierView): string {
  return renderMarkup(<ModelDossier model={model} onPrint={noop} onCopyLink={noop} />);
}

void test('real terrain prints its attribution verbatim', () => {
  const markup = render(createRealDossierFixture());

  assert.ok(markup.includes(dossierTerrainAttribution));
  assert.match(markup, /aria-label="Attribution"/);
});

void test('procedural landscapes print no attribution block', () => {
  assert.ok(!render(createProceduralDossierFixture()).includes('Attribution'));
});

void test('the road credit is printed when roads are on', () => {
  assert.ok(render(createModelDossierFixture()).includes('Roads © OpenStreetMap contributors'));
});

void test('the style link is printed as text with a screen-only Copy button', () => {
  const markup = render(createProceduralDossierFixture());

  assert.ok(markup.includes('https://landcu.be/?v=1&amp;seed=123'));
  assert.match(markup, /lc-dossier__screen-only[^>]*><button[^>]*><span[^>]*>Copy<\/span>/);
});

void test('readouts, palette and footer render', () => {
  const markup = render(createModelDossierFixture());

  for (const text of [
    'Span',
    'Frame',
    'tray',
    'Height',
    '#202326',
    'LANDCU.BE',
    '29 October 2026',
  ]) {
    assert.ok(markup.includes(text), `missing ${text}`);
  }
});

void test('the brand lockup is not a heading and the sheet has a Print button', () => {
  const markup = render(createProceduralDossierFixture());

  assert.ok(!markup.includes('<h1'));
  assert.match(markup, /<button[^>]*><span[^>]*>Print<\/span>/);
});
