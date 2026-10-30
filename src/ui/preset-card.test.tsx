import assert from 'node:assert/strict';
import test from 'node:test';
import { PresetCard, PresetStrip } from './preset-card';
import { renderMarkup } from './test-helpers';

void test('PresetCard is a toggle button named by its preset', () => {
  const markup = renderMarkup(
    <PresetCard
      name="Paper"
      swatches={['#eee9dd', '#716c5e']}
      isActive
      onSelect={() => undefined}
    />,
  );

  assert.match(markup, /^<button class="lc-preset-card" type="button" aria-pressed="true">/);
  assert.match(markup, />Paper<\/span>/);
});

void test('PresetCard draws one hidden stripe per swatch', () => {
  const markup = renderMarkup(
    <PresetCard name="Blueprint" swatches={['#153c68', '#b9dbf5']} onSelect={() => undefined} />,
  );

  assert.match(markup, /lc-preset-card__swatches" aria-hidden="true"/);
  assert.equal(markup.match(/style="background:/g)?.length, 2);
  assert.match(markup, /aria-pressed="false"/);
});

void test('PresetStrip is a labelled group around its cards', () => {
  const markup = renderMarkup(
    <PresetStrip label="Palettes">
      <PresetCard name="A" swatches={[]} onSelect={() => undefined} />
    </PresetStrip>,
  );

  assert.match(markup, /^<div class="lc-preset-strip" role="group" aria-label="Palettes">/);
});
