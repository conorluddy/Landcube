import assert from 'node:assert/strict';
import test from 'node:test';
import { Tag } from './tag';
import { renderMarkup } from './test-helpers';

void test('Tag renders its variant as a data attribute on an lc-tag span', () => {
  const markup = renderMarkup(<Tag variant="outlineMuted">Draft</Tag>);

  assert.match(markup, /^<span class="lc-tag" data-variant="outlineMuted">/);
});

void test('Tag keeps authoring case so accessible names still match', () => {
  const markup = renderMarkup(<Tag variant="fileType">Svg</Tag>);

  assert.match(markup, />Svg<\/span>$/);
});

void test('Tag renders a long label as a single text node', () => {
  const label = 'A very long exported status label that must stay on one line';
  const markup = renderMarkup(<Tag variant="outlineBone">{label}</Tag>);

  assert.ok(markup.includes(`>${label}</span>`));
  assert.ok(!markup.includes('<br'));
});
