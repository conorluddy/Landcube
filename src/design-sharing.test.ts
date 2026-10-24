import { parseDesignParameters } from './design-settings';
import { copyDesignLink, loadInitialDesign, readLockedSeed, replaceDesignUrl, saveLockedSeed } from './design-sharing';
import assert from 'node:assert/strict';
import { test } from 'node:test';

/** Provides isolated in-memory storage for seed persistence scenarios. */
function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); }, clear: () => values.clear(), key: index => [...values.keys()][index] ?? null };
}

test('plain visits use the viewport and prefer the locked seed, while explicit links override it', () => {
  /** Verifies plain visits use the viewport and prefer the locked seed, while explicit links override it. */
  const viewport = { width: 390, height: 844 };
  const plain = loadInitialDesign(new URLSearchParams(), viewport, 123, 456);
  assert.ok(plain.ok);
  assert.equal(plain.data.settings.seed, 456);
  assert.equal(plain.data.settings.width, 390);
  const fresh = loadInitialDesign(new URLSearchParams(), viewport, 123, null);
  assert.ok(fresh.ok);
  assert.equal(fresh.data.settings.seed, 123);
  const shared = loadInitialDesign(new URLSearchParams('v=1&seed=789&width=1080&height=1920'), viewport, 123, 456);
  assert.ok(shared.ok);
  assert.equal(shared.data.settings.seed, 789);
  assert.equal(shared.data.settings.height, 1920);
  const partial = loadInitialDesign(new URLSearchParams('v=1&detail=0.5'), viewport, 123, 456);
  assert.ok(partial.ok);
  assert.equal(partial.data.settings.seed, 456);
  const bounded = loadInitialDesign(new URLSearchParams(), { width: 9000, height: 50 }, 0, null);
  assert.ok(bounded.ok);
  assert.equal(bounded.data.settings.width, 4096);
  assert.equal(bounded.data.settings.height, 64);
  assert.equal(loadInitialDesign(new URLSearchParams('v=7'), viewport, 123, null).ok, false);
});

test('seed locking supports seed zero, unlocking, and malformed stored values', () => {
  /** Verifies seed locking supports seed zero, unlocking, and malformed stored values. */
  const storage = memoryStorage();
  assert.deepEqual(readLockedSeed(storage), { ok: true, data: null });
  assert.ok(saveLockedSeed(storage, 0).ok);
  assert.deepEqual(readLockedSeed(storage), { ok: true, data: 0 });
  assert.ok(saveLockedSeed(storage, null).ok);
  assert.deepEqual(readLockedSeed(storage), { ok: true, data: null });
  for (const raw of ['-1', '4294967296', '', '12px']) {
    storage.setItem('topogra-locked-seed', raw);
    assert.equal(readLockedSeed(storage).ok, false);
  }
});

test('unavailable storage and clipboard return actionable failures', async () => {
  /** Verifies unavailable storage and clipboard return actionable failures. */
  const storage = memoryStorage();
  storage.getItem = () => { throw new Error('Denied'); };
  storage.setItem = () => { throw new Error('Denied'); };
  storage.removeItem = () => { throw new Error('Denied'); };
  assert.equal(readLockedSeed(storage).ok, false);
  assert.equal(saveLockedSeed(storage, 12).ok, false);
  assert.equal(saveLockedSeed(storage, null).ok, false);
  assert.equal((await copyDesignLink('https://example.test', undefined)).ok, false);
  assert.equal((await copyDesignLink('https://example.test', { writeText: async () => { throw new Error('Denied'); } })).ok, false);
  let copied = '';
  assert.ok((await copyDesignLink('https://example.test', { writeText: async text => { copied = text; } })).ok);
  assert.equal(copied, 'https://example.test');
});

test('URL synchronization replaces the current entry while preserving history state', () => {
  /** Verifies URL synchronization replaces the current entry while preserving history state. */
  const parsed = parseDesignParameters(new URLSearchParams('seed=52'));
  assert.ok(parsed.ok);
  const state = { navigation: 'existing' };
  const calls: unknown[][] = [];
  const url = replaceDesignUrl('https://topogra.example', parsed.data.settings, { state, replaceState: (...args: unknown[]) => { calls.push(args); } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], state);
  assert.equal(calls[0][2], url);
  assert.equal(new URL(url).searchParams.get('seed'), '52');
});

test('a blocked address-bar update still provides the complete share link and logs the failure', context => {
  /** Verifies a blocked address-bar update still provides the complete share link and logs the failure. */
  const parsed = parseDesignParameters(new URLSearchParams('seed=4'));
  assert.ok(parsed.ok);
  const warnings: string[] = [];
  context.mock.method(console, 'warn', (message: string) => { warnings.push(message); });
  const url = replaceDesignUrl('https://topogra.example', parsed.data.settings, { state: null, replaceState: () => { throw new Error('Denied'); } });
  assert.equal(new URL(url).searchParams.get('seed'), '4');
  assert.equal(JSON.parse(warnings[0]).code, 'URL_FAILED');
});
