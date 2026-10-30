import assert from 'node:assert/strict';
import test from 'node:test';
import { ChoiceTiles } from './choice-tiles';
import { renderMarkup } from './test-helpers';

const noop = (): void => undefined;
const options = [
  { value: 'a', label: 'Alpha', swatchColor: '#112233', swatchBorderColor: '#445566' },
  { value: 'b', label: 'Beta', description: 'Second tile' },
  { value: 'c', label: 'Gamma', thumbnail: <svg /> },
];

void test('ChoiceTiles renders a labelled group of aria-pressed buttons', () => {
  const markup = renderMarkup(
    <ChoiceTiles label="Frame style" value="b" options={options} onChange={noop} />,
  );

  assert.match(markup, /role="group" aria-label="Frame style"/);
  assert.match(markup, /aria-pressed="false"[^>]*>[\s\S]*?Alpha/);
  assert.match(markup, /aria-pressed="true"[^>]*title="Second tile"/);
});

void test('ChoiceTiles lets isPressedComputed override value equality', () => {
  const markup = renderMarkup(
    <ChoiceTiles
      label="Palette"
      value="a"
      options={options}
      isPressedComputed={(option) => option.value === 'c'}
      onChange={noop}
    />,
  );

  assert.equal(markup.match(/aria-pressed="true"/g)?.length, 1);
  assert.match(markup, /aria-pressed="true"[^>]*>[\s\S]*?Gamma/);
});

void test('ChoiceTiles records its column count', () => {
  const markup = renderMarkup(
    <ChoiceTiles label="Palette" value="a" options={options} columns={6} onChange={noop} />,
  );

  assert.match(markup, /data-columns="6"/);
});

void test('ChoiceTiles passes swatch colours as custom properties and hides decoration', () => {
  const markup = renderMarkup(
    <ChoiceTiles label="Palette" value="a" options={options} onChange={noop} />,
  );

  assert.ok(markup.includes('--lc-tile-swatch:#112233'));
  assert.ok(markup.includes('--lc-tile-swatch-border:#445566'));
  assert.match(markup, /class="lc-choice-tiles__thumbnail" aria-hidden="true"/);
});

void test('ChoiceTiles gives only the pressed tile a tab stop', () => {
  const markup = renderMarkup(
    <ChoiceTiles label="Palette" value="b" options={options} onChange={noop} />,
  );

  assert.equal(markup.match(/tabindex="0"/g)?.length, 1);
  assert.equal(markup.match(/tabindex="-1"/g)?.length, 2);
});

void test('ChoiceTiles disables every tile', () => {
  const markup = renderMarkup(
    <ChoiceTiles label="Palette" value="a" options={options} disabled onChange={noop} />,
  );

  assert.equal(markup.match(/disabled=""/g)?.length, 3);
});
