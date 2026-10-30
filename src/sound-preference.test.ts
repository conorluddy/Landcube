import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isSoundMuted,
  readSoundMuted,
  setSoundMuted,
  soundMutedStorageKey,
  subscribeToSoundMuted,
} from './sound-preference';

function createMemoryStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

void test('sound is on for a first visit and when storage is blocked', () => {
  assert.equal(readSoundMuted(createMemoryStorage()), false);
  assert.equal(
    readSoundMuted({
      getItem: () => {
        throw new Error('blocked');
      },
    }),
    false,
  );
});

void test('muting persists, notifies subscribers, and unmuting clears the stored choice', () => {
  const storage = createMemoryStorage();
  const heard: boolean[] = [];
  const unsubscribe = subscribeToSoundMuted((isMuted) => heard.push(isMuted));

  setSoundMuted(true, storage);
  assert.equal(readSoundMuted(storage), true);
  assert.equal(isSoundMuted(), true);

  setSoundMuted(false, storage);
  assert.equal(storage.getItem(soundMutedStorageKey), null);
  assert.equal(isSoundMuted(), false);
  assert.deepEqual(heard, [true, false]);
  unsubscribe();
});
