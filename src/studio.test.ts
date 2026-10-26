import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createStudioController, type StudioEffects } from './studio/controller';
import {
  parseDesignParameters,
  serializeDesignParameters,
  validateDesignSettings,
} from './design-settings';

function setup() {
  const initial = parseDesignParameters(new URLSearchParams('v=1&seed=123&width=480&height=320'));

  assert.ok(initial.ok);
  let design = initial.data.settings;
  let modelChanges = 0;
  const effects: StudioEffects = {
    applyTerrain: () => undefined,
    activate: () => Promise.resolve(),
    sceneChanged: () => undefined,
    modelChanged: () => {
      modelChanges++;
    },
    resetCamera: () => undefined,
    applyViewPreset: () => undefined,
    pickFocus: () => Promise.resolve(false),
    downloadStill: () => Promise.resolve({ width: 1, height: 1 }),
    downloadStl: () => undefined,
  };
  const controller = createStudioController({
    getSettings: () => design,
    updateSettings: (candidate) => {
      const result = validateDesignSettings(candidate);

      if (!result.ok) {
        return false;
      }

      design = result.data;

      return true;
    },
    newLandscape: () => {
      const result = validateDesignSettings({ ...design, seed: design.seed + 1 });

      assert.ok(result.ok);
      design = result.data;
    },
    isSeedLocked: false,
    lockSeed: () => undefined,
    getShareUrl: () => `https://topogra.test/?${serializeDesignParameters(design).toString()}`,
    copyLink: () => Promise.resolve({ ok: true, data: undefined }),
  });

  controller.connect(effects);

  return { controller, effects, modelChanges: () => modelChanges };
}

void test('studio switches views without losing independent sections or project edits', async () => {
  const { controller: c } = setup();

  c.selectSection('Colour');
  c.selectSection('Model');
  assert.equal(c.getSnapshot().workspace.sections['2d'], 'Colour');
  await c.selectView('3d');
  c.selectSection('Model');
  c.dimensions({ widthMm: 180, lengthMm: 90 });
  c.scene({ ground: false });
  await c.selectView('2d');
  assert.equal(c.getSnapshot().workspace.sections['2d'], 'Colour');
  await c.selectView('3d');
  assert.equal(c.getSnapshot().workspace.sections['3d'], 'Model');
  assert.equal(c.getSnapshot().model.dimensions.widthMm, 180);
  assert.equal(c.getSnapshot().scene.ground, false);
});

void test('failed view activation preserves all settings and releases the activation lock', async () => {
  const { controller: c, effects } = setup();

  c.design({ strokeWidth: 1.5 });
  effects.activate = () => Promise.reject(new Error('WebGL unavailable'));
  await c.selectView('3d');
  assert.equal(c.getSnapshot().workspace.view, '2d');
  assert.equal(c.getSnapshot().workspace.activating, false);
  assert.equal(c.getSnapshot().design.strokeWidth, 1.5);
  assert.match(c.getSnapshot().status, /WebGL 2/);
});

void test('invalid model edits retain the printable setup and do not reach the renderer', () => {
  const { controller: c, modelChanges } = setup();

  assert.equal(c.dimensions({ widthMm: 0 }), false);
  assert.equal(c.model({ exaggeration: NaN }), false);
  assert.equal(c.getSnapshot().model.dimensions.widthMm, 150);
  assert.equal(modelChanges(), 0);
  assert.equal(c.dimensions({ widthMm: 180 }), true);
  assert.equal(modelChanges(), 1);
});

void test('scene and model edits cannot leak into version-one style links', async () => {
  const { controller: c } = setup();
  const before = serializeDesignParameters(c.getSnapshot().design).toString();

  c.material('porcelain');
  c.dimensions({ widthMm: 220, cropShape: 'circle' });
  c.lighting({ direction: 75 });
  await c.selectView('3d');
  assert.equal(serializeDesignParameters(c.getSnapshot().design).toString(), before);
  c.lockSeed(true);
  c.newLandscape();
  assert.equal(c.getSnapshot().design.seed, 123);
  c.lockSeed(false);
  c.newLandscape();
  assert.equal(c.getSnapshot().design.seed, 124);
});

void test('gradient validation retains the previous palette and snapshots remain stable', () => {
  const { controller: c } = setup();
  const snapshot = c.getSnapshot();

  c.scene({
    gradient: { enabled: true, transition: 'soft', stops: [{ position: 0.5, color: '#ffffff' }] },
  });
  assert.deepEqual(c.getSnapshot().scene.gradient, snapshot.scene.gradient);
  c.material('porcelain');
  assert.equal(snapshot.scene.materialPreset, 'natural');
  assert.equal(c.getSnapshot().scene.materialPreset, 'porcelain');
});

void test('location loads and source switches morph terrain while interval and hatching edits cut', async (t) => {
  const { controller: c, effects } = setup();
  const transitions: boolean[] = [];

  effects.applyTerrain = (_terrain, shouldTransition) => {
    transitions.push(shouldTransition);
  };

  stubBrowserTileDecoding(t);
  await c.loadTerrain();
  assert.match(c.getSnapshot().source.status, /Real terrain loaded/);
  c.interval(50);
  c.hatching(false);
  c.useGenerated();
  await c.useCoordinates();
  assert.match(c.getSnapshot().source.status, /restored/);
  assert.deepEqual(transitions, [true, false, false, true, true]);
});

/** Serves flat Terrarium tiles through the browser decoding path without a network or canvas. */
function stubBrowserTileDecoding(t: TestContext): void {
  const tileSizePixels = 256;
  const pixels = new Uint8ClampedArray(tileSizePixels * tileSizePixels * 4).fill(128);

  t.mock.method(globalThis, 'fetch', () => Promise.resolve(new Response('tile')));
  Object.assign(globalThis, {
    createImageBitmap: () => Promise.resolve({ close: () => undefined }),
    document: {
      createElement: () => ({
        getContext: () => ({ drawImage: () => undefined, getImageData: () => ({ data: pixels }) }),
      }),
    },
  });
  t.after(() => {
    Reflect.deleteProperty(globalThis, 'createImageBitmap');
    Reflect.deleteProperty(globalThis, 'document');
  });
}
