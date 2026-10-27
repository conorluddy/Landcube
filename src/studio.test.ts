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
    frameChanged: () => undefined,
    downloadFrameStl: () => undefined,
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
  c.selectSection('Camera');
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

void test('new sessions colour the land by elevation from the loaded location', async (t) => {
  const { controller: c } = setup();

  assert.equal(c.getSnapshot().scene.gradient.enabled, true);
  assert.equal(c.getSnapshot().scene.gradientSource, 'location');
  stubBrowserTileDecoding(t);
  await c.loadTerrain();
  assert.equal(c.getSnapshot().scene.gradientPreset, 'landscape-temperate');
});

void test('location gradient follows loaded places until the user picks one', async (t) => {
  const { controller: c } = setup();

  stubBrowserTileDecoding(t);
  await c.loadTerrain();
  assert.equal(c.getSnapshot().scene.gradientPreset, 'landscape-temperate');

  c.scene({ gradientPreset: 'paper', gradientSource: 'user' });
  c.source({ latitude: 53.2707, longitude: -9.0568 });
  await c.loadTerrain();
  assert.equal(c.getSnapshot().scene.gradientPreset, 'paper');

  c.scene({ gradientSource: 'location' });
  assert.equal(c.getSnapshot().scene.gradientPreset, 'landscape-coastal');
});

void test('autoplay tours preset locations after each delay until switched off', async (t) => {
  const { controller: c } = setup();

  stubBrowserTileDecoding(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  await c.autoplay({ enabled: true, delaySeconds: 5 });
  const firstPlace = c.getSnapshot().source.place;

  assert.equal(c.getSnapshot().source.selected, 'real');
  t.mock.timers.tick(5000);
  await new Promise(setImmediate);
  assert.notEqual(c.getSnapshot().source.place, firstPlace);

  const secondPlace = c.getSnapshot().source.place;

  await c.autoplay({ enabled: false });
  t.mock.timers.tick(60_000);
  await new Promise(setImmediate);
  assert.equal(c.getSnapshot().source.place, secondPlace);
});

void test('default location loads bundled tiles and credits only their recorded sources', async (t) => {
  const { controller: c } = setup();
  const requestedUrls: string[] = [];

  stubBrowserTileDecoding(t);
  t.mock.method(globalThis, 'fetch', (url: string) => {
    requestedUrls.push(url);

    return Promise.resolve(new Response('tile', pngHeaders));
  });
  await c.loadTerrain();

  assert.ok(requestedUrls.length > 0);
  assert.ok(requestedUrls.every((url) => url.startsWith('https://topogra.test/terrain-tiles/')));
  assert.match(c.getSnapshot().source.terrain?.attribution ?? '', /Copernicus/);
  assert.doesNotMatch(c.getSnapshot().source.terrain?.attribution ?? '', /Geological Survey/);
});

void test('bundled tiles served as HTML fall back to the public tile service', async (t) => {
  const { controller: c } = setup();
  const requestedUrls: string[] = [];

  stubBrowserTileDecoding(t);
  t.mock.method(console, 'warn', () => undefined);
  t.mock.method(globalThis, 'fetch', (url: string) => {
    requestedUrls.push(url);

    // Static hosts may answer a missing bundled file with their HTML page and a 200 status.
    return Promise.resolve(
      url.includes('/terrain-tiles/')
        ? new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } })
        : new Response('tile', pngHeaders),
    );
  });
  await c.loadTerrain();

  assert.match(c.getSnapshot().source.status, /Real terrain loaded/);
  assert.ok(requestedUrls.some((url) => url.includes('/terrarium/')));
});

void test('daylight cycle sweeps the sun until a manual lighting edit pauses it', (t) => {
  const { controller: c } = setup();

  t.mock.timers.enable({ apis: ['setInterval', 'Date'] });
  c.daylightCycle({ enabled: true, daySeconds: 60 });
  const startHour = c.getSnapshot().scene.lighting.timeOfDay;

  t.mock.timers.tick(5000);
  assert.ok(c.getSnapshot().scene.lighting.timeOfDay > startHour);

  c.lighting({ timeOfDay: 12 });
  t.mock.timers.tick(5000);
  assert.equal(c.getSnapshot().scene.daylightCycle.enabled, false);
  assert.equal(c.getSnapshot().scene.lighting.timeOfDay, 12);
});

const pngHeaders = { headers: { 'content-type': 'image/png' } };

/** Serves flat Terrarium tiles through the browser decoding path without a network or canvas. */
function stubBrowserTileDecoding(t: TestContext): void {
  const tileSizePixels = 256;
  const pixels = new Uint8ClampedArray(tileSizePixels * tileSizePixels * 4).fill(128);

  t.mock.method(globalThis, 'fetch', () => Promise.resolve(new Response('tile', pngHeaders)));
  Object.assign(globalThis, {
    createImageBitmap: () => Promise.resolve({ close: () => undefined }),
    document: {
      baseURI: 'https://topogra.test/',
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

void test('frame assembly waits for the model height, then follows model and frame edits', () => {
  const { controller: c } = setup();

  c.frame({ preset: 'tray' });
  assert.equal(c.getSnapshot().frame.assembly, undefined);

  c.metrics(24);
  const tray = c.getSnapshot().frame.assembly;

  assert.ok(tray?.ok === true);
  assert.deepEqual(
    tray.data.parts.map(({ id }) => id),
    ['frame'],
  );
  assert.ok(Math.abs(tray.data.parts[0].sizeMm.x - 170.6) < 1e-4);

  assert.ok(c.dimensions({ cropShape: 'circle' }));
  const round = c.getSnapshot().frame.assembly;

  assert.ok(round?.ok === true);
  assert.ok(Math.abs(round.data.parts[0].sizeMm.x - (150 + 2 * 10.3)) < 1e-3);
});

void test('an unprintable frame keeps its error and blocks part downloads', () => {
  const { controller: c } = setup();

  c.metrics(24);
  c.frame({ preset: 'tray', borderWidthMm: 0.5 });
  const assembly = c.getSnapshot().frame.assembly;

  assert.ok(assembly?.ok === false);
  assert.match(assembly.error.message, /minimum is 1\.2 mm/);

  c.downloadFrameStl('frame');
  assert.match(c.getSnapshot().status, /Frame part frame is not available/);
});

void test('a finish change recolours the preview without rebuilding the parts', () => {
  const { controller: c, effects } = setup();
  let frameChanges = 0;

  effects.frameChanged = () => {
    frameChanges++;
  };

  c.metrics(24);
  c.frame({ preset: 'tray' });
  const tray = c.getSnapshot().frame.assembly;

  c.frame({ finish: 'white' });
  assert.equal(c.getSnapshot().frame.assembly, tray);
  assert.equal(frameChanges, 3);
});

void test('removing a frame empties the assembly so the model drops back to the floor', () => {
  const { controller: c } = setup();

  c.metrics(24);
  c.frame({ preset: 'pedestal' });
  assert.ok(c.getSnapshot().frame.assembly?.ok === true);

  c.frame({ preset: 'none' });
  const none = c.getSnapshot().frame.assembly;

  assert.ok(none?.ok === true);
  assert.deepEqual(none.data.parts, []);
  assert.equal(none.data.seatHeightMm, 0);
});

void test('frame errors the tab can explain name its controls', () => {
  const { controller: c } = setup();

  c.metrics(24);
  c.frame({ preset: 'pedestal', borderWidthMm: 5, edgeShape: 'chamfer', edgeSizeMm: 4.5 });
  const assembly = c.getSnapshot().frame.assembly;

  assert.ok(assembly?.ok === false);
  assert.match(assembly.error.message, /Increase Overhang or reduce Edge size/);
});
