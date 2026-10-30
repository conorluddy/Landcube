import assert from 'node:assert/strict';
import test from 'node:test';
import { isFindShortcut, readBrowseStep } from './browse-keys';

const plain = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };

void test('down and right step forward, up and left step back', () => {
  assert.equal(readBrowseStep({ ...plain, key: 'ArrowDown' }), 1);
  assert.equal(readBrowseStep({ ...plain, key: 'ArrowRight' }), 1);
  assert.equal(readBrowseStep({ ...plain, key: 'ArrowUp' }), -1);
  assert.equal(readBrowseStep({ ...plain, key: 'ArrowLeft' }), -1);
});

void test('modified arrows are left to the browser, so Alt+← still goes back', () => {
  for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey'] as const) {
    assert.equal(readBrowseStep({ ...plain, [modifier]: true, key: 'ArrowLeft' }), undefined);
  }
});

void test('other keys do not browse', () => {
  assert.equal(readBrowseStep({ ...plain, key: 'j' }), undefined);
});

void test('Cmd+F, Ctrl+F and a bare slash open Find', () => {
  assert.equal(isFindShortcut({ ...plain, key: 'f', metaKey: true }), true);
  assert.equal(isFindShortcut({ ...plain, key: 'F', ctrlKey: true }), true);
  assert.equal(isFindShortcut({ ...plain, key: '/' }), true);
});

void test('other combinations do not open Find', () => {
  assert.equal(isFindShortcut({ ...plain, key: 'f' }), false);
  assert.equal(isFindShortcut({ ...plain, key: 'f', metaKey: true, shiftKey: true }), false);
  assert.equal(isFindShortcut({ ...plain, key: '/', altKey: true }), false);
});
