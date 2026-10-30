import assert from 'node:assert/strict';
import test from 'node:test';
import { PartRow } from './part-row';
import { renderMarkup } from './test-helpers';

void test('PartRow is a button showing the code, name and count', () => {
  const markup = renderMarkup(
    <PartRow
      code="PRIM.04"
      name="Ruler slider"
      count="03"
      isActive={false}
      onSelect={() => undefined}
    />,
  );

  assert.match(markup, /^<button type="button" class="lc-part-row">/);
  assert.match(markup, />PRIM\.04</);
  assert.match(markup, />Ruler slider</);
  assert.match(markup, /aria-hidden="true">03</);
});

void test('PartRow marks the active part with aria-current', () => {
  const markup = renderMarkup(
    <PartRow code="PRIM.04" name="Ruler slider" count="03" isActive onSelect={() => undefined} />,
  );

  assert.match(markup, /aria-current="true"/);
});
