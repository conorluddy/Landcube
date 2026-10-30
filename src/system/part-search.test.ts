import assert from 'node:assert/strict';
import test from 'node:test';
import { findParts, groupParts, stepPart } from './part-search';
import { systemParts } from './registry';

void test('find matches name, summary, group and code without regard to case', () => {
  assert.deepEqual(
    findParts(systemParts, 'SLIDER').map((part) => part.id),
    ['ruler-slider'],
  );
  assert.ok(findParts(systemParts, 'prim.01').some((part) => part.id === 'button'));
  assert.ok(findParts(systemParts, 'inputs').length > 5);
});

void test('find matches a component by its specimen name and a foundation by its tokens', () => {
  assert.ok(findParts(systemParts, 'tab-bar').some((part) => part.id === 'tab-bar'));
  assert.ok(findParts(systemParts, '--lc-ink').some((part) => part.id === 'ink'));
});

void test('a blank query finds nothing', () => {
  assert.deepEqual(findParts(systemParts, '   '), []);
});

void test('stepping wraps from the last part to the first and back', () => {
  const first = systemParts[0];
  const last = systemParts[systemParts.length - 1];

  assert.equal(stepPart(systemParts, last.id, 1).id, first.id);
  assert.equal(stepPart(systemParts, first.id, -1).id, last.id);
  assert.equal(stepPart(systemParts, first.id, 1).id, systemParts[1].id);
});

void test('stepping from an unknown id starts at the first part', () => {
  assert.equal(stepPart(systemParts, 'missing', 1).id, systemParts[1].id);
});

void test('groups keep consecutive parts together in order', () => {
  const groups = groupParts(
    systemParts.filter((part) => part.section === 'FNDN'),
    (part) => part.group,
  );

  assert.deepEqual(
    groups.map((group) => group.title),
    ['Colour', 'Surface', 'Type', 'Measure', 'Motion'],
  );
});

void test('find matches a layout by its source file', () => {
  assert.ok(findParts(systemParts, 'studio-phone.css').some((part) => part.id === 'mobile-shell'));
});
