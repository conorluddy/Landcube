import assert from 'node:assert/strict';
import test from 'node:test';
import { Kbd } from './kbd';
import { renderMarkup } from './test-helpers';

void test('Kbd renders one kbd per key', () => {
  const markup = renderMarkup(<Kbd keys={['⌘', 'K']} />);

  assert.equal(markup.match(/<kbd /g)?.length, 2);
  assert.ok(!markup.includes('aria-hidden'));
  assert.ok(!markup.includes('aria-label'));
});

void test('Kbd label names the shortcut and hides the individual keys', () => {
  const markup = renderMarkup(<Kbd keys={['⌘', 'K']} label="Command K" />);

  assert.match(markup, /aria-label="Command K"/);
  assert.equal(markup.match(/aria-hidden="true"/g)?.length, 2);
});

void test('Kbd with no keys renders an empty wrapper', () => {
  assert.ok(!renderMarkup(<Kbd keys={[]} />).includes('<kbd'));
});
