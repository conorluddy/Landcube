import assert from 'node:assert/strict';
import test from 'node:test';
import { Segmented } from './segmented';
import { renderMarkup } from './test-helpers';

const options = [
  { value: '2d', label: '2D', description: 'Flat map view' },
  { value: '3d', label: '3D' },
];

void test('Segmented renders a labelled group of aria-pressed buttons', () => {
  const markup = renderMarkup(
    <Segmented label="View" value="3d" options={options} onChange={() => undefined} />,
  );

  assert.match(markup, /role="group" aria-labelledby="[^"]+"/);
  assert.match(markup, /aria-pressed="false"[^>]*>2D</);
  assert.match(markup, /aria-pressed="true"[^>]*>3D</);
});

void test('Segmented puts the label on the group when it is not visible', () => {
  const markup = renderMarkup(
    <Segmented
      label="View"
      value="2d"
      options={options}
      isLabelVisible={false}
      onChange={() => undefined}
    />,
  );

  assert.match(markup, /role="group" aria-label="View"/);
  assert.ok(!markup.includes('aria-labelledby'));
  assert.ok(!markup.includes('lc-segmented-row__label'));
});

void test('Segmented uses the description as a tooltip and keeps the visible name', () => {
  const markup = renderMarkup(
    <Segmented label="View" value="2d" options={options} onChange={() => undefined} />,
  );

  assert.ok(markup.includes('title="Flat map view"'));
  assert.ok(!markup.includes('aria-label="Flat map view"'));
});

void test('Segmented gives only the selected option a tab stop', () => {
  const markup = renderMarkup(
    <Segmented label="View" value="3d" options={options} onChange={() => undefined} />,
  );

  assert.match(markup, /tabindex="-1"[^>]*>2D</);
  assert.match(markup, /tabindex="0"[^>]*>3D</);
});

void test('Segmented throws on one option', () => {
  assert.throws(
    () =>
      renderMarkup(
        <Segmented
          label="View"
          value="a"
          options={[{ value: 'a', label: 'A' }]}
          onChange={() => undefined}
        />,
      ),
    /needs 2 to 4 options, got 1/,
  );
});

void test('Segmented throws on five options', () => {
  const five = ['a', 'b', 'c', 'd', 'e'].map((value) => ({ value, label: value }));

  assert.throws(
    () =>
      renderMarkup(<Segmented label="View" value="a" options={five} onChange={() => undefined} />),
    /got 5/,
  );
});

void test('Segmented disables every option and records its size', () => {
  const markup = renderMarkup(
    <Segmented
      label="View"
      value="2d"
      options={options}
      size="large"
      disabled
      onChange={() => undefined}
    />,
  );

  assert.match(markup, /data-size="large"/);
  assert.equal(markup.match(/disabled=""/g)?.length, 2);
});
