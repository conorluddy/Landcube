import assert from 'node:assert/strict';
import test from 'node:test';
import { BarGroup, FloatingBar } from './floating-bar';
import { renderMarkup } from './test-helpers';

void test('FloatingBar renders the requested landmark element with its size', () => {
  const header = renderMarkup(<FloatingBar as="header">pills</FloatingBar>);
  const footer = renderMarkup(
    <FloatingBar as="footer" size="footer">
      pills
    </FloatingBar>,
  );

  assert.match(header, /^<header class="lc-floating-bar" data-size="bar" data-ui-surface="true">/);
  assert.match(footer, /^<footer class="lc-floating-bar" data-size="footer"/);
});

void test('FloatingBar defaults to a div and appends the caller class', () => {
  assert.match(
    renderMarkup(<FloatingBar className="studio-header">pills</FloatingBar>),
    /^<div class="lc-floating-bar studio-header" data-size="bar"/,
  );
});

void test('each BarGroup is a glass pill marked as a UI surface', () => {
  const markup = renderMarkup(
    <BarGroup role="toolbar" label="Viewport tools">
      tools
    </BarGroup>,
  );

  assert.match(markup, /class="lc-bar-group lc-glass"/);
  assert.match(markup, /data-ui-surface="true"/);
  assert.match(markup, /role="toolbar" aria-label="Viewport tools"/);
});

void test('a spacer BarGroup renders no glass, role or content', () => {
  const markup = renderMarkup(<BarGroup isSpacer>ignored</BarGroup>);

  assert.equal(markup, '<div class="lc-bar-group" data-spacer="true" aria-hidden="true"></div>');
});

void test('a BarGroup without a role stays a plain container', () => {
  assert.ok(!renderMarkup(<BarGroup>brand</BarGroup>).includes('role='));
});
