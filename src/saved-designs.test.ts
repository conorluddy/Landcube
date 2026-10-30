import assert from 'node:assert/strict';
import test from 'node:test';
import {
  savedDesignLimit,
  savedDesignsStorageKey,
  savedDesignThumbnailMaxBytes,
} from './constants/library';
import {
  addSavedDesign,
  fitThumbnail,
  readSavedDesigns,
  removeSavedDesign,
  writeSavedDesigns,
  type SavedDesign,
} from './saved-designs';

function design(id: string): SavedDesign {
  return {
    id,
    name: `Design ${id}`,
    savedAt: '2026-01-01T00:00:00.000Z',
    link: `https://landcube.test/?v=1&seed=${id}`,
    thumbnailSvg: '<svg/>',
    source: 'procedural',
    seedOrPlace: id,
  };
}

function memoryStorage(initial?: string) {
  const items = new Map<string, string>(
    initial === undefined ? [] : [[savedDesignsStorageKey, initial]],
  );

  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
  };
}

void test('saved designs survive a write and read', () => {
  const storage = memoryStorage();

  writeSavedDesigns(storage, [design('1')]);

  assert.deepEqual(readSavedDesigns(storage), { ok: true, data: [design('1')] });
});

void test('empty storage reads as an empty Library', () => {
  assert.deepEqual(readSavedDesigns(memoryStorage()), { ok: true, data: [] });
});

void test('corrupt JSON is a storage error so the Library can explain the empty state', () => {
  const result = readSavedDesigns(memoryStorage('{not json'));

  assert.ok(!result.ok);
  assert.equal(result.error.code, 'STORAGE_FAILED');
  assert.match(result.error.message, /corrupt/);
});

void test('stored data that is not a list is corrupt', () => {
  assert.equal(readSavedDesigns(memoryStorage('{"a":1}')).ok, false);
});

void test('malformed entries are skipped without losing valid ones', () => {
  const storage = memoryStorage(JSON.stringify([design('1'), { id: 2 }, null, design('3')]));
  const result = readSavedDesigns(storage);

  assert.ok(result.ok);
  assert.deepEqual(
    result.data.map((entry) => entry.id),
    ['1', '3'],
  );
});

void test('blocked storage is a recoverable error on read and write', () => {
  const blocked = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
  };
  const read = readSavedDesigns(blocked);
  const write = writeSavedDesigns(blocked, [design('1')]);

  assert.ok(!read.ok && read.error.retryable);
  assert.ok(!write.ok && write.error.retryable);
});

void test('a newly saved design goes first and the list is capped', () => {
  let saved: SavedDesign[] = [];

  for (let index = 0; index < savedDesignLimit + 3; index++) {
    saved = addSavedDesign(saved, design(String(index)));
  }

  assert.equal(saved.length, savedDesignLimit);
  assert.equal(saved[0].id, String(savedDesignLimit + 2));
});

void test('saving an existing id replaces it instead of duplicating', () => {
  const saved = addSavedDesign([design('1'), design('2')], { ...design('2'), name: 'Renamed' });

  assert.deepEqual(
    saved.map((entry) => entry.id),
    ['2', '1'],
  );
  assert.equal(saved[0].name, 'Renamed');
});

void test('removeSavedDesign drops only the matching id', () => {
  assert.deepEqual(
    removeSavedDesign([design('1'), design('2')], '1').map((entry) => entry.id),
    ['2'],
  );
});

void test('fitThumbnail keeps small previews and drops oversized ones', () => {
  assert.equal(fitThumbnail('<svg/>'), '<svg/>');
  assert.equal(fitThumbnail('x'.repeat(savedDesignThumbnailMaxBytes + 1)), null);
});

const savedRoute = {
  version: 1,
  id: 'route-1',
  name: 'Ridge',
  provenance: 'drawn',
  waypoints: [
    { latitude: 55.01, longitude: -8.14 },
    { latitude: 55.02, longitude: -8.13 },
  ],
  namedWaypoints: [{ name: 'Hut', latitude: 55.01, longitude: -8.14 }],
  slopeThresholdPercent: 15,
} as const;
const savedTerrain = { latitude: 55.01, longitude: -8.14, spanKm: 12, maxDepth: 40 };

function readBack(entry: unknown): SavedDesign | undefined {
  const result = readSavedDesigns(memoryStorage(JSON.stringify([entry])));

  assert.ok(result.ok);

  return result.data[0];
}

void test('a design with terrain and a route round-trips through storage unchanged', () => {
  const withRoute: SavedDesign = {
    ...design('1'),
    source: 'real',
    terrain: savedTerrain,
    route: {
      ...savedRoute,
      waypoints: [...savedRoute.waypoints],
      namedWaypoints: [...savedRoute.namedWaypoints],
    },
  };
  const storage = memoryStorage();

  writeSavedDesigns(storage, [withRoute]);

  assert.deepEqual(readSavedDesigns(storage), { ok: true, data: [withRoute] });
});

void test('entries saved before routes existed still load without terrain or route', () => {
  assert.deepEqual(readBack(design('1')), design('1'));
});

void test('a malformed route is dropped but the design and its terrain survive', () => {
  const entry = {
    ...design('1'),
    terrain: savedTerrain,
    route: { ...savedRoute, waypoints: [{ latitude: 'x' }] },
  };

  assert.deepEqual(readBack(entry), { ...design('1'), terrain: savedTerrain });
});

void test('a route with an unknown version or out-of-range threshold is dropped', () => {
  assert.equal(
    readBack({ ...design('1'), route: { ...savedRoute, version: 2 } })?.route,
    undefined,
  );
  assert.equal(
    readBack({ ...design('1'), route: { ...savedRoute, slopeThresholdPercent: 500 } })?.route,
    undefined,
  );
});

void test('malformed terrain is dropped but the design survives', () => {
  const entry = { ...design('1'), terrain: { ...savedTerrain, latitude: 120 } };

  assert.deepEqual(readBack(entry), design('1'));
});
