import assert from 'node:assert/strict';
import test from 'node:test';
import { applySignalAccent, currentSignalAccent, readSignalAccent } from './accent';

const key = 'landcube-signal-accent';

function fakeStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));

  return {
    store,
    getItem: (name: string) => store.get(name) ?? null,
    setItem: (name: string, value: string) => void store.set(name, value),
    removeItem: (name: string) => void store.delete(name),
  };
}

void test('accent defaults to bone and ignores unknown stored values', () => {
  assert.equal(readSignalAccent(fakeStorage(), key), 'bone');
  assert.equal(readSignalAccent(fakeStorage({ [key]: 'magenta' }), key), 'bone');
  assert.equal(readSignalAccent(fakeStorage({ [key]: 'amber' }), key), 'amber');
});

void test('applying amber sets the attribute and persists; bone clears both', () => {
  const root = { dataset: {} as DOMStringMap };
  const storage = fakeStorage();

  applySignalAccent('amber', root, storage, key);
  assert.equal(root.dataset.signalAccent, 'amber');
  assert.equal(storage.store.get(key), 'amber');
  assert.equal(currentSignalAccent(root), 'amber');

  applySignalAccent('bone', root, storage, key);
  assert.equal(root.dataset.signalAccent, undefined);
  assert.equal(storage.store.has(key), false);
});

void test('blocked storage still applies the accent and does not throw', () => {
  const root = { dataset: {} as DOMStringMap };
  const blocked = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
    removeItem: () => {
      throw new Error('blocked');
    },
  };

  applySignalAccent('phosphor', root, blocked, key);
  assert.equal(root.dataset.signalAccent, 'phosphor');
  assert.equal(readSignalAccent(blocked, key), 'bone');
});
