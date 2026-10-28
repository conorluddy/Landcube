import assert from 'node:assert/strict';
import test from 'node:test';
import { savedPlaceLimit, savedPlacesStorageKey } from './constants/place-search';
import { addSavedPlace, readSavedPlaces, writeSavedPlaces, type SavedPlace } from './saved-places';

function place(name: string, latitude = 56.8): SavedPlace {
  return { name, region: 'Scotland', latitude, longitude: -5 };
}

function memoryStorage(initial?: string) {
  const items = new Map<string, string>(
    initial === undefined ? [] : [[savedPlacesStorageKey, initial]],
  );

  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
  };
}

void test('saved places survive a write and read', () => {
  const storage = memoryStorage();

  writeSavedPlaces(storage, [place('Ben Nevis')]);

  assert.deepEqual(readSavedPlaces(storage), { ok: true, data: [place('Ben Nevis')] });
});

void test('a revisited place moves to the front instead of repeating', () => {
  const saved = addSavedPlace([place('Snowdon', 53), place('Ben Nevis')], place('Ben Nevis'));

  assert.deepEqual(
    saved.map((entry) => entry.name),
    ['Ben Nevis', 'Snowdon'],
  );
});

void test('only the newest places are kept', () => {
  let saved: SavedPlace[] = [];

  for (let index = 0; index <= savedPlaceLimit; index++) {
    saved = addSavedPlace(saved, place(`Place ${index}`, index));
  }

  assert.equal(saved.length, savedPlaceLimit);
  assert.equal(saved[0]?.name, `Place ${savedPlaceLimit}`);
});

void test('corrupt storage reads as no places and malformed entries are skipped', () => {
  assert.deepEqual(readSavedPlaces(memoryStorage('not json')), { ok: true, data: [] });
  assert.deepEqual(
    readSavedPlaces(memoryStorage(JSON.stringify([place('Ben Nevis'), { name: 'Nowhere' }]))),
    { ok: true, data: [place('Ben Nevis')] },
  );
});

void test('blocked storage is a storage failure', () => {
  const blocked = {
    getItem: () => {
      throw new Error('SecurityError');
    },
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
  };

  assert.equal(readSavedPlaces(blocked).ok, false);
  assert.equal(writeSavedPlaces(blocked, []).ok, false);
});
