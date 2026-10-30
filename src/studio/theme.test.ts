import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTheme, currentTheme, readTheme, subscribeToTheme, themeStorageKey } from './theme';

function fakeStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    store,
  };
}

void test('theme defaults to dark and ignores unknown stored values', () => {
  assert.equal(readTheme(fakeStorage()), 'dark');
  assert.equal(readTheme(fakeStorage({ [themeStorageKey]: 'sepia' })), 'dark');
  assert.equal(readTheme(fakeStorage({ [themeStorageKey]: 'light' })), 'light');
});

void test('applying light sets data-theme and persists; applying dark clears both', () => {
  const root = { dataset: {} as DOMStringMap };
  const storage = fakeStorage();
  const seen: string[] = [];
  const unsubscribe = subscribeToTheme((theme) => seen.push(theme));

  applyTheme('light', root, storage);
  assert.equal(root.dataset.theme, 'light');
  assert.equal(storage.store.get(themeStorageKey), 'light');
  assert.equal(currentTheme(root), 'light');

  applyTheme('dark', root, storage);
  assert.equal(root.dataset.theme, undefined);
  assert.equal(storage.store.has(themeStorageKey), false);
  assert.deepEqual(seen, ['light', 'dark']);
  unsubscribe();
});

void test('applying a theme survives blocked storage', () => {
  const root = { dataset: {} as DOMStringMap };
  const blocked = {
    setItem: () => {
      throw new Error('blocked');
    },
    removeItem: () => {
      throw new Error('blocked');
    },
  };

  applyTheme('light', root, blocked);
  assert.equal(root.dataset.theme, 'light');
});
