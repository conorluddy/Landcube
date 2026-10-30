import assert from 'node:assert/strict';
import test from 'node:test';
import { splashSeenStorageKey } from '../../constants/library';
import { markSplashSeen, shouldShowSplash } from './splash-session';

function session(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));

  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

void test('a fresh phone session at the bare URL shows the splash', () => {
  assert.equal(shouldShowSplash(true, false, session()), true);
});

void test('desktop, design links and seen sessions skip the splash', () => {
  assert.equal(shouldShowSplash(false, false, session()), false);
  assert.equal(shouldShowSplash(true, true, session()), false);
  assert.equal(shouldShowSplash(true, false, session({ [splashSeenStorageKey]: '1' })), false);
});

void test('marking the splash seen is remembered for the session', () => {
  const storage = session();

  markSplashSeen(storage);
  assert.equal(shouldShowSplash(true, false, storage), false);
});

void test('blocked session storage shows the splash and never throws on write', () => {
  const blocked = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
  };

  assert.equal(shouldShowSplash(true, false, blocked), true);
  markSplashSeen(blocked);
});
