import assert from 'node:assert/strict';
import test from 'node:test';
import { GroupHeader } from './group-header';
import { renderMarkup } from './test-helpers';

void test('GroupHeader renders the title and a decorative rule', () => {
  const markup = renderMarkup(<GroupHeader title="Frame" />);

  assert.match(markup, />Frame<\/span>/);
  assert.match(markup, /class="lc-group-header__rule" aria-hidden="true"/);
  assert.ok(!markup.includes('lc-group-header__code'));
  assert.ok(!markup.includes('lc-group-header__trailing'));
});

void test('GroupHeader hides the code from assistive tech', () => {
  const markup = renderMarkup(<GroupHeader title="Frame" code="CONT.03" />);

  assert.match(markup, /<span class="lc-group-header__code" aria-hidden="true">CONT\.03<\/span>/);
});

void test('GroupHeader renders trailing content after the rule', () => {
  const markup = renderMarkup(<GroupHeader title="Frame" trailing={<b>Reset</b>} />);

  assert.ok(markup.indexOf('__rule') < markup.indexOf('<b>Reset</b>'));
});
