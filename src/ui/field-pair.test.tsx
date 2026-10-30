import assert from 'node:assert/strict';
import test from 'node:test';
import { FieldPair } from './field-pair';
import { renderMarkup } from './test-helpers';

void test('FieldPair renders both children inside one grid in order', () => {
  const markup = renderMarkup(
    <FieldPair>
      <span>first</span>
      <span>second</span>
    </FieldPair>,
  );

  assert.match(
    markup,
    /<div class="lc-field-pair"><div class="lc-field-pair__grid"><span>first<\/span><span>second<\/span><\/div><\/div>/,
  );
});
