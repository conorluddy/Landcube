import assert from 'node:assert/strict';
import test from 'node:test';
import { SignalMark } from './signal-mark';
import { renderMarkup } from './test-helpers';

void test('SignalMark without a label is decorative', () => {
  const markup = renderMarkup(<SignalMark kind="ok" />);

  assert.match(markup, /aria-hidden="true"/);
  assert.ok(!markup.includes('role='));
  assert.match(markup, /data-size="default"/);
  assert.match(markup, /data-accent="bone"/);
});

void test('SignalMark with a label is an image with that accessible name', () => {
  const markup = renderMarkup(<SignalMark kind="fault" label="Coverage gap" />);

  assert.match(markup, /role="img"/);
  assert.match(markup, /aria-label="Coverage gap"/);
  assert.ok(!markup.includes('aria-hidden'));
});

void test('SignalMark carries kind, size and accent as data attributes', () => {
  const markup = renderMarkup(<SignalMark kind="live" size="footer" accent="phosphor" />);

  assert.match(markup, /data-kind="live"/);
  assert.match(markup, /data-size="footer"/);
  assert.match(markup, /data-accent="phosphor"/);
});
