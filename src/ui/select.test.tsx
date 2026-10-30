import assert from 'node:assert/strict';
import test from 'node:test';
import { Select } from './select';
import { renderMarkup } from './test-helpers';

const noop = (): void => undefined;

void test('Select renders a native select labelled by for/id', () => {
  const markup = renderMarkup(
    <Select id="format" label="Format" value="svg" options={['svg', 'png']} onChange={noop} />,
  );

  assert.match(markup, /<label[^>]*for="format">Format<\/label>/);
  assert.match(markup, /<select[^>]*id="format"/);
  assert.match(markup, /<option value="svg" selected="">svg<\/option>/);
});

void test('Select accepts value and label option objects', () => {
  const markup = renderMarkup(
    <Select
      label="Grid"
      value="x"
      options={[
        { value: 'x', label: 'Crosses' },
        { value: 'y', label: 'Squares' },
      ]}
      onChange={noop}
    />,
  );

  assert.match(markup, /<option value="y">Squares<\/option>/);
});

void test('Select renders optgroups and hides position for grouped options', () => {
  const markup = renderMarkup(
    <Select
      label="Place"
      value="a"
      options={[
        { group: 'Alps', options: [{ value: 'a', label: 'Matterhorn' }] },
        { group: 'Andes', options: [{ value: 'b', label: 'Aconcagua' }] },
      ]}
      onChange={noop}
    />,
  );

  assert.match(markup, /<optgroup label="Alps">/);
  assert.match(markup, /<optgroup label="Andes">/);
  assert.ok(!markup.includes('lc-select__position'));
});

void test('Select shows a zero-padded position for short ungrouped lists', () => {
  const markup = renderMarkup(
    <Select label="Size" value="c" options={['a', 'b', 'c', 'd']} onChange={noop} />,
  );

  assert.match(markup, /aria-hidden="true">03\/04<\/span>/);
});

void test('Select hides position beyond twelve options unless forced on', () => {
  const thirteen = Array.from({ length: 13 }, (_, index) => `v${String(index)}`);
  const hidden = renderMarkup(
    <Select label="Many" value="v1" options={thirteen} onChange={noop} />,
  );
  const forced = renderMarkup(
    <Select label="Many" value="v1" options={thirteen} isPositionShown onChange={noop} />,
  );

  assert.ok(!hidden.includes('lc-select__position'));
  assert.match(forced, />02\/13</);
});

void test('Select can hide the position and be disabled', () => {
  const markup = renderMarkup(
    <Select
      label="Size"
      value="a"
      options={['a', 'b']}
      isPositionShown={false}
      disabled
      onChange={noop}
    />,
  );

  assert.ok(!markup.includes('lc-select__position'));
  assert.match(markup, /disabled=""/);
});

void test('Select shows no position when the value matches no option', () => {
  const markup = renderMarkup(
    <Select label="Size" value="zzz" options={['a', 'b']} onChange={noop} />,
  );

  assert.ok(!markup.includes('lc-select__position'));
});
