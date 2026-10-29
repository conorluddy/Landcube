import assert from 'node:assert/strict';
import test from 'node:test';
import { renderMarkup } from './test-helpers';
import { ValueChip } from './value-chip';

const noop = (): void => undefined;

void test('ValueChip is an unpressed button by default', () => {
  const markup = renderMarkup(<ValueChip label="25 M" onClick={noop} />);

  assert.match(markup, /^<button class="lc-value-chip" type="button" aria-pressed="false">25 M</);
});

void test('ValueChip reflects isSelected in aria-pressed', () => {
  const markup = renderMarkup(<ValueChip label="25 M" isSelected onClick={noop} />);

  assert.match(markup, /aria-pressed="true"/);
});

void test('ValueChip can be disabled', () => {
  const markup = renderMarkup(<ValueChip label="25 M" disabled onClick={noop} />);

  assert.match(markup, /disabled=""/);
});
