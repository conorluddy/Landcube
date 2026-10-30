import { versionOneDesignDefaults } from './constants/design';
import { parseDesignParameters } from './design-settings';
import {
  copyDesignLink,
  hasDesignParameters,
  loadInitialDesign,
  readDesignStyle,
  readLockedSeed,
  replaceDesignUrl,
  saveDesignStyle,
  saveLockedSeed,
} from './design-sharing';
import assert from 'node:assert/strict';
import { test } from 'node:test';

/** Provides isolated in-memory storage for seed persistence scenarios. */
function memoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
    clear: () => {
      values.clear();
    },
    key: (index) => [...values.keys()][index] ?? null,
  };
}

await test('plain visits use the viewport and prefer the locked seed, while explicit links override it', () => {
  /** Verifies plain visits use the viewport and prefer the locked seed, while explicit links override it. */
  const viewport = { width: 390, height: 844 };
  const plain = loadInitialDesign(new URLSearchParams(), viewport, 123, 456);

  assert.ok(plain.ok);
  assert.equal(plain.data.settings.seed, 456);
  assert.equal(plain.data.settings.width, 390);
  const fresh = loadInitialDesign(new URLSearchParams(), viewport, 123, null);

  assert.ok(fresh.ok);
  assert.equal(fresh.data.settings.seed, 123);
  const shared = loadInitialDesign(
    new URLSearchParams('v=1&seed=789&width=1080&height=1920'),
    viewport,
    123,
    456,
  );

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

await test('a fresh visit opens with the stored style but its own seed, landscape and size', () => {
  const storage = memoryStorage();
  const edited = parseDesignParameters(
    new URLSearchParams('v=1&seed=9&detail=0.9&lineColor=%23ff0000&strokeWidth=1.5&width=600'),
  );

  assert.ok(edited.ok);
  assert.ok(saveDesignStyle(storage, edited.data.settings).ok);
  const style = readDesignStyle(storage);

  assert.ok(style.ok);
  const fresh = loadInitialDesign(
    new URLSearchParams(),
    { width: 390, height: 844 },
    123,
    null,
    style.data,
  );

  assert.ok(fresh.ok);
  assert.equal(fresh.data.settings.lineColor, '#ff0000');
  assert.equal(fresh.data.settings.strokeWidth, 1.5);
  assert.equal(fresh.data.settings.seed, 123);
  assert.equal(fresh.data.settings.detail, versionOneDesignDefaults.detail);
  assert.equal(fresh.data.settings.width, 390);
});

await test('design links ignore the stored style', () => {
  const style = new URLSearchParams('v=1&lineColor=%23ff0000');
  const link = loadInitialDesign(
    new URLSearchParams('v=1&seed=5'),
    { width: 390, height: 844 },
    123,
    null,
    style,
  );

  assert.ok(link.ok);
  assert.equal(link.data.settings.lineColor, versionOneDesignDefaults.lineColor);
});

await test('a stored style from an unknown version opens with the default style', () => {
  const fresh = loadInitialDesign(
    new URLSearchParams(),
    { width: 390, height: 844 },
    123,
    null,
    new URLSearchParams('v=7&lineColor=%23ff0000'),
  );

  assert.ok(fresh.ok);
  assert.equal(fresh.data.settings.lineColor, versionOneDesignDefaults.lineColor);
});

await test('seed locking supports seed zero, unlocking, and malformed stored values', () => {
  /** Verifies seed locking supports seed zero, unlocking, and malformed stored values. */
  const storage = memoryStorage();

  assert.deepEqual(readLockedSeed(storage), { ok: true, data: null });
  assert.ok(saveLockedSeed(storage, 0).ok);
  assert.deepEqual(readLockedSeed(storage), { ok: true, data: 0 });
  assert.ok(saveLockedSeed(storage, null).ok);
  assert.deepEqual(readLockedSeed(storage), { ok: true, data: null });

  for (const raw of ['-1', '4294967296', '', '12px']) {
    // Legacy storage key kept across the landcube rename so existing data survives.
    storage.setItem('topogra-locked-seed', raw);
    assert.equal(readLockedSeed(storage).ok, false);
  }
});

await test('unavailable storage and clipboard return actionable failures', async () => {
  /** Verifies unavailable storage and clipboard return actionable failures. */
  const storage = memoryStorage();

  storage.getItem = () => {
    throw new Error('Denied');
  };

  storage.setItem = () => {
    throw new Error('Denied');
  };

  storage.removeItem = () => {
    throw new Error('Denied');
  };

  assert.equal(readLockedSeed(storage).ok, false);
  assert.equal(readDesignStyle(storage).ok, false);
  assert.equal(saveDesignStyle(storage, versionOneDesignDefaults).ok, false);
  assert.equal(saveLockedSeed(storage, 12).ok, false);
  assert.equal(saveLockedSeed(storage, null).ok, false);
  assert.equal((await copyDesignLink('https://example.test', undefined)).ok, false);
  assert.equal(
    (
      await copyDesignLink('https://example.test', {
        writeText: () => Promise.reject(new Error('Denied')),
      })
    ).ok,
    false,
  );
  let copied = '';

  assert.ok(
    (
      await copyDesignLink('https://example.test', {
        writeText: (text) => {
          copied = text;

          return Promise.resolve();
        },
      })
    ).ok,
  );
  assert.equal(copied, 'https://example.test');
});

await test('URL synchronization replaces the current entry while preserving history state', () => {
  /** Verifies URL synchronization replaces the current entry while preserving history state. */
  const parsed = parseDesignParameters(new URLSearchParams('seed=52'));

  assert.ok(parsed.ok);
  const state = { navigation: 'existing' };
  const calls: unknown[][] = [];
  const url = replaceDesignUrl('https://landcube.example', parsed.data.settings, {
    state,
    replaceState: (...args: unknown[]) => {
      calls.push(args);
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], state);
  assert.equal(calls[0][2], url);
  assert.equal(new URL(url).searchParams.get('seed'), '52');
});

await test('a blocked address-bar update still provides the complete share link and logs the failure', (context) => {
  /** Verifies a blocked address-bar update still provides the complete share link and logs the failure. */
  const parsed = parseDesignParameters(new URLSearchParams('seed=4'));

  assert.ok(parsed.ok);
  const warnings: string[] = [];

  context.mock.method(console, 'warn', (message: string) => {
    warnings.push(message);
  });
  const url = replaceDesignUrl('https://landcube.example', parsed.data.settings, {
    state: null,
    replaceState: () => {
      throw new Error('Denied');
    },
  });

  assert.equal(new URL(url).searchParams.get('seed'), '4');
  const warning: unknown = JSON.parse(warnings[0]);

  assert.ok(typeof warning === 'object' && warning !== null && 'code' in warning);
  assert.equal(warning.code, 'URL_FAILED');
});

void test('design URL sync keeps a design-system link in the address bar but not the share URL', () => {
  const parsed = parseDesignParameters(new URLSearchParams('seed=7'));

  assert.ok(parsed.ok);
  const calls: unknown[][] = [];
  const url = replaceDesignUrl(
    'https://landcube.example/?mode=system&part=tag',
    parsed.data.settings,
    {
      state: null,
      replaceState: (...args: unknown[]) => {
        calls.push(args);
      },
    },
  );
  const addressBar = new URL(String(calls[0][2]));

  assert.equal(addressBar.searchParams.get('mode'), 'system');
  assert.equal(addressBar.searchParams.get('part'), 'tag');
  assert.equal(addressBar.searchParams.get('seed'), '7');
  assert.equal(new URL(url).searchParams.has('mode'), false);
});

void test('a design-system link alone is not a design link', () => {
  assert.equal(hasDesignParameters(new URLSearchParams('mode=system&part=PRIM.04')), false);
});

void test('only design parameters turn a visit into a design link', () => {
  assert.equal(hasDesignParameters(new URLSearchParams('v=1')), true);
  assert.equal(hasDesignParameters(new URLSearchParams('seed=234')), true);
  assert.equal(hasDesignParameters(new URLSearchParams('')), false);
  assert.equal(hasDesignParameters(new URLSearchParams('utm_source=newsletter')), false);
});
