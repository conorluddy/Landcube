import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDesignParameters } from '../design-settings';
import { createStudioController, type SceneSettings } from './controller';
import {
  readStoredScene,
  saveStoredScene,
  sceneFieldChoices,
  sceneStorageKey,
} from './scene-storage';

void test('nothing stored restores the default 3D look', () => {
  const defaults = createDefaultScene();
  const result = readStoredScene(createMemoryStorage(), defaults);

  assert.ok(result.ok);
  assert.deepEqual(result.data, defaults);
});

void test('a saved 3D look restores, but camera, turntable and previews stay session-only', () => {
  const defaults = createDefaultScene();
  const storage = createMemoryStorage();
  const edited: SceneSettings = {
    ...defaults,
    groundColor: '#202326',
    landFinish: 'satin',
    waterOpacity: 0.8,
    lighting: { ...defaults.lighting, timeOfDay: 18 },
    grass: { ...defaults.grass, enabled: true, preset: 'custom' },
    camera: { ...defaults.camera, focalLengthMm: defaults.camera.focalLengthMm + 10 },
    rotating: true,
    previewWater: true,
  };

  assert.ok(saveStoredScene(storage, edited).ok);
  const result = readStoredScene(storage, defaults);

  assert.ok(result.ok);
  assert.deepEqual(result.data, {
    ...edited,
    camera: defaults.camera,
    rotating: false,
    previewWater: false,
  });
});

void test('a stale or tampered field falls back to its default without losing the rest', () => {
  const defaults = createDefaultScene();
  const storage = createMemoryStorage();

  storage.setItem(
    sceneStorageKey,
    JSON.stringify({
      version: 1,
      scene: {
        groundColor: '#202326',
        landFinish: 'chrome',
        waterColor: 'blue',
        waterOpacity: 'opaque',
        gradient: { ...defaults.gradient, stops: [{ position: 0, color: '#000000' }] },
        lighting: { timeOfDay: 6 },
      },
    }),
  );
  const result = readStoredScene(storage, defaults);

  assert.ok(result.ok);
  assert.equal(result.data.groundColor, '#202326');
  assert.equal(result.data.lighting.timeOfDay, 6);
  assert.equal(result.data.lighting.intensity, defaults.lighting.intensity);
  assert.equal(result.data.landFinish, defaults.landFinish);
  assert.equal(result.data.waterColor, defaults.waterColor);
  assert.equal(result.data.waterOpacity, defaults.waterOpacity);
  assert.deepEqual(result.data.gradient, defaults.gradient);
});

void test('an unreadable or unknown-version saved look reports a storage failure', () => {
  const defaults = createDefaultScene();

  for (const raw of ['{not json', JSON.stringify({ version: 99, scene: {} })]) {
    const storage = createMemoryStorage();

    storage.setItem(sceneStorageKey, raw);
    const result = readStoredScene(storage, defaults);

    assert.ok(!result.ok);
    assert.equal(result.error.code, 'STORAGE_FAILED');
  }
});

void test('every non-colour text field in the 3D look lists its allowed values', () => {
  const sessionOnly = new Set(['camera']);
  const textFields = listTextFields(createDefaultScene()).filter(
    ([path, value]) => !sessionOnly.has(path.split('.')[0]) && !/^#[0-9a-f]{6}$/i.test(value),
  );

  for (const [path, value] of textFields) {
    assert.ok(
      sceneFieldChoices[path]?.includes(value) === true,
      `${path} needs choices including ${value}`,
    );
  }
});

// === HELPERS ===

function createDefaultScene(): SceneSettings {
  const parsed = parseDesignParameters(new URLSearchParams('v=1&seed=1'));

  assert.ok(parsed.ok);

  return createStudioController({
    getSettings: () => parsed.data.settings,
    updateSettings: () => true,
    newLandscape: () => undefined,
    isSeedLocked: false,
    lockSeed: () => undefined,
    getShareUrl: () => 'https://landcube.test/',
    copyLink: () => Promise.resolve({ ok: true, data: undefined }),
  }).getSnapshot().scene;
}

function listTextFields(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') {
    return [[path, value]];
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    listTextFields(child, path ? `${path}.${key}` : key),
  );
}

function createMemoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}
