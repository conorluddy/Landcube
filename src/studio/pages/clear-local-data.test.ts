import assert from 'node:assert/strict';
import test from 'node:test';
import { clearLocalStorageKeys, clearTerrainTileCache } from './clear-local-data';

function arrayStorage(entries: Record<string, string>) {
  const items = new Map(Object.entries(entries));

  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
    key: (index: number) => [...items.keys()][index] ?? null,
    get length() {
      return items.size;
    },
  };
}

void test('clearing removes landcube and topogra keys and leaves others', () => {
  const storage = arrayStorage({
    'landcube-saved-designs': '[]',
    'landcube-theme': 'light',
    'topogra-locked-seed': '1',
    'topogra-searched-places': '[]',
    'other-app': 'keep',
  });
  const result = clearLocalStorageKeys(storage);

  assert.deepEqual(result, { ok: true, data: 4 });
  assert.deepEqual([...storage.items.keys()], ['other-app']);
});

void test('clearing blocked storage reports a retryable error', () => {
  const blocked = {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    key: () => null,
    get length(): number {
      throw new Error('blocked');
    },
  };
  const result = clearLocalStorageKeys(blocked);

  assert.ok(!result.ok && result.error.retryable);
});

void test('clearing the tile cache deletes only terrain tile caches', async () => {
  const deleted: string[] = [];

  await clearTerrainTileCache({
    keys: () => Promise.resolve(['topogra-terrain-tiles-v1', 'other']),
    delete: (name) => {
      deleted.push(name);

      return Promise.resolve(true);
    },
  });
  assert.deepEqual(deleted, ['topogra-terrain-tiles-v1']);
});

void test('clearing the tile cache tolerates missing and failing Cache Storage', async () => {
  await clearTerrainTileCache(undefined);
  await clearTerrainTileCache({
    keys: () => Promise.reject(new Error('blocked')),
    delete: () => Promise.resolve(false),
  });
});
