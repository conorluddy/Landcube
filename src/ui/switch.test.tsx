import assert from 'node:assert/strict';
import test from 'node:test';
import { Switch } from './switch';
import { renderMarkup } from './test-helpers';

const noop = (): void => undefined;

void test('Switch exposes a checked role=switch input associated by label for', () => {
  const markup = renderMarkup(<Switch id="seed-lock" label="Lock seed" value onChange={noop} />);

  assert.match(markup, /<label class="lc-switch__row" for="seed-lock">/);
  assert.match(markup, /<input[^>]*id="seed-lock"[^>]*type="checkbox"[^>]*role="switch"/);
  assert.match(markup, /checked=""/);
});

void test('Switch is unchecked when off', () => {
  const markup = renderMarkup(<Switch label="Lock seed" value={false} onChange={noop} />);

  assert.ok(!markup.includes('checked=""'));
});

void test('Switch hides the OFF and ON cells from assistive technology', () => {
  const markup = renderMarkup(<Switch label="Lock seed" value={false} onChange={noop} />);

  assert.match(markup, /class="lc-switch__track" aria-hidden="true"/);
  assert.match(markup, />OFF<[\s\S]*>ON</);
});

void test('Switch generates an id when none is given', () => {
  const markup = renderMarkup(<Switch label="Lock seed" value onChange={noop} />);
  const forId = /for="([^"]+)"/.exec(markup)?.[1];

  assert.ok(forId !== undefined);
  assert.ok(markup.includes(`id="${forId}"`));
});

void test('Switch links a description without changing the label', () => {
  const markup = renderMarkup(
    <Switch id="s" label="Lock seed" description="Keeps the terrain" value onChange={noop} />,
  );

  assert.ok(markup.includes('aria-describedby="s-description"'));
  assert.ok(markup.includes('id="s-description"'));
  assert.match(markup, /<span class="lc-switch__text">Lock seed<\/span>/);
});

void test('Switch can be disabled', () => {
  const markup = renderMarkup(<Switch label="Lock seed" value disabled onChange={noop} />);

  assert.match(markup, /disabled=""/);
});
