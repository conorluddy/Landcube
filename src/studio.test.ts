import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import {
  createStudioController,
  describeRoadNetwork,
  getSceneCredits,
  type StudioEffects,
} from './studio/controller';
import { defaultRoadStyle } from './constants/roads';
import { grassPresets } from './constants/grass';
import {
  parseDesignParameters,
  serializeDesignParameters,
  validateDesignSettings,
} from './design-settings';

function setup(fetchRoads?: typeof fetch, placeStorage?: Pick<Storage, 'getItem' | 'setItem'>) {
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
    setCameraDirection: () => undefined,
    applyViewPreset: () => undefined,
    pickFocus: () => Promise.resolve(false),
    captureCameraShot: () => undefined,
    flyToCameraShot: () => undefined,
    playCameraShots: () => undefined,
    stopCameraShots: () => undefined,
    downloadStill: () => Promise.resolve({ width: 1, height: 1 }),
    downloadStl: () => undefined,
    roadsChanged: () => undefined,
    frameChanged: () => undefined,
    downloadFrameStl: () => undefined,
  };
  const controller = createStudioController(
    {
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
      getShareUrl: () => `https://landcube.test/?${serializeDesignParameters(design).toString()}`,
      copyLink: () => Promise.resolve({ ok: true, data: undefined }),
    },
    fetchRoads,
    placeStorage,
  );

  controller.connect(effects);

  return { controller, effects, modelChanges: () => modelChanges };
}

void test('studio starts with 0.35 height exaggeration', () => {
  const { controller } = setup();

  assert.equal(controller.getSnapshot().model.exaggeration, 0.35);
});

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

void test('the phone sheet opens at half and its snap never reaches the style link', () => {
  const { controller: c } = setup();
  const linkBefore = c.getSnapshot().design;

  assert.equal(c.getSnapshot().workspace.sheetSnap, 'half');
  c.workspace({ sheetSnap: 'full' });
  assert.equal(c.getSnapshot().workspace.sheetSnap, 'full');
  assert.equal(c.getSnapshot().design, linkBefore);
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
  c.roads({ enabled: true, detail: 'tracks', color: '#ff0000', widthMm: 2, texture: 1 });
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

void test('the tour waits when another terrain load is in flight', async (t) => {
  const { controller: c } = setup();

  stubBrowserTileDecoding(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  await c.autoplay({ enabled: true, delaySeconds: 5 });
  const before = c.getSnapshot().source.place;
  const pendingFetch = t.mock.method(
    globalThis,
    'fetch',
    () => new Promise<Response>(() => undefined),
  );

  void c.loadTerrain();
  assert.equal(c.getSnapshot().source.loading, true);
  t.mock.timers.tick(5000);
  assert.equal(c.getSnapshot().source.place, before);
  await c.autoplay({ enabled: false });
  pendingFetch.mock.restore();
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
  assert.ok(requestedUrls.every((url) => url.startsWith('https://landcube.test/terrain-tiles/')));
  assert.match(c.getSnapshot().source.terrain?.attribution ?? '', /Copernicus/);
  assert.doesNotMatch(c.getSnapshot().source.terrain?.attribution ?? '', /Geological Survey/);
});

void test('a searched place is saved and listed once its terrain loads', async (t) => {
  const items = new Map<string, string>();
  const storage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
  };
  const { controller: c } = setup(undefined, storage);
  const match = {
    name: 'Ben Nevis',
    detail: 'Scotland, United Kingdom',
    latitude: 56.7969,
    longitude: -5.0035,
    provider: 'photon' as const,
  };

  stubBrowserTileDecoding(t);
  await c.loadSearchedPlace(match);

  const saved = {
    name: 'Ben Nevis',
    region: 'Scotland, United Kingdom',
    latitude: 56.7969,
    longitude: -5.0035,
  };

  assert.deepEqual(c.getSnapshot().savedPlaces, [saved]);
  assert.equal(c.getSnapshot().source.place, '56.7969,-5.0035');
  assert.deepEqual(setup(undefined, storage).controller.getSnapshot().savedPlaces, [saved]);
});

void test('a searched place can load with an explicit area span', async (t) => {
  const { controller: c } = setup();

  stubBrowserTileDecoding(t);
  await c.loadSearchedPlace(
    {
      name: 'Ben Nevis',
      detail: 'Scotland',
      latitude: 56.7969,
      longitude: -5.0035,
      provider: 'photon',
    },
    50,
  );
  assert.equal(c.getSnapshot().source.spanKm, 50);
  assert.equal(c.getSnapshot().source.place, '56.7969,-5.0035');
});

void test('searched places from separate tabs are merged when each load succeeds', async (t) => {
  const items = new Map<string, string>();
  const storage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
  };
  const first = setup(undefined, storage).controller;
  const second = setup(undefined, storage).controller;

  stubBrowserTileDecoding(t);
  await first.loadSearchedPlace({
    name: 'Ben Nevis',
    detail: '',
    latitude: 56.7969,
    longitude: -5.0035,
    provider: 'photon',
  });
  await second.loadSearchedPlace({
    name: 'Snowdon',
    detail: '',
    latitude: 53.0685,
    longitude: -4.076,
    provider: 'photon',
  });
  assert.deepEqual(
    setup(undefined, storage)
      .controller.getSnapshot()
      .savedPlaces.map((place) => place.name),
    ['Snowdon', 'Ben Nevis'],
  );
});

void test('a failed searched place is not saved by a later manual load', async (t) => {
  const { controller: c } = setup();

  stubBrowserTileDecoding(t);
  const fetchStub = t.mock.method(globalThis, 'fetch', () => Promise.reject(new Error('offline')));

  await c.loadSearchedPlace({
    name: 'Ben Nevis',
    detail: '',
    latitude: 56.7969,
    longitude: -5.0035,
    provider: 'photon',
  });
  fetchStub.mock.restore();
  await c.loadTerrain();
  assert.deepEqual(c.getSnapshot().savedPlaces, []);
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

void test('resetting lighting pauses the daylight cycle', (t) => {
  const { controller: c } = setup();

  t.mock.timers.enable({ apis: ['setInterval', 'Date'] });
  c.daylightCycle({ enabled: true });
  c.resetLighting();
  const reset = c.getSnapshot().scene.lighting;

  t.mock.timers.tick(5000);
  assert.equal(c.getSnapshot().scene.daylightCycle.enabled, false);
  assert.deepEqual(c.getSnapshot().scene.lighting, reset);
});

void test('road edits restyle without refetching and a superseded download never reaches the new place', async (t) => {
  const requests: ((elements: unknown[]) => void)[] = [];
  const { controller: c, effects } = setup(
    () =>
      new Promise((resolve) => {
        // Ignores abort signals, so a superseded response still arrives late.
        requests.push((elements) => {
          resolve(Response.json({ elements }));
        });
      }),
  );
  let roadUpdates = 0;

  effects.roadsChanged = () => {
    roadUpdates++;
  };

  stubBrowserTileDecoding(t);
  await c.loadTerrain();
  c.roads({ enabled: true });
  assert.equal(requests.length, 1);
  assert.equal(c.getSnapshot().roads.loading, true);

  c.source({ latitude: 53.2707, longitude: -9.0568 });
  await c.loadTerrain();
  assert.equal(requests.length, 2);
  requests[1]([roadElement(2)]);
  await new Promise(setImmediate);
  requests[0]([roadElement(1)]);
  await new Promise(setImmediate);
  assert.deepEqual(
    c.getSnapshot().roads.network?.roads.map((road) => road.id),
    [2],
  );

  c.roads({ color: '#ff0000', widthMm: 1.2, detail: 'major' });
  c.roads({ enabled: false });
  c.roads({ enabled: true });
  assert.equal(requests.length, 2);
  assert.equal(roadUpdates, 1);
  assert.equal(c.getSnapshot().scene.roads.color, '#ff0000');
});

void test('a failed road download keeps the terrain and explains how to recover', async (t) => {
  const { controller: c } = setup(() => Promise.resolve(new Response('', { status: 504 })));

  stubBrowserTileDecoding(t);
  await c.loadTerrain();
  const terrain = c.getSnapshot().source.terrain;

  c.roads({ enabled: true });
  await new Promise(setImmediate);
  assert.equal(c.getSnapshot().source.terrain, terrain);
  assert.equal(c.getSnapshot().roads.loading, false);
  assert.match(c.getSnapshot().roads.status, /busy/);
  assert.equal(c.getSnapshot().roads.canRetry, true);
});

void test('style edits after a failed road download never refetch; Retry does', async (t) => {
  let downloads = 0;
  const { controller: c } = setup(() => {
    downloads++;

    return Promise.resolve(new Response('', { status: 502 }));
  });

  stubBrowserTileDecoding(t);
  await c.loadTerrain();
  c.roads({ enabled: true });
  await new Promise(setImmediate);

  for (let index = 0; index < 30; index++) {
    c.roads({ widthMm: 0.5 + index / 100, autoWidth: false });
  }

  await new Promise(setImmediate);
  assert.equal(downloads, 1);
  c.retryRoads();
  await new Promise(setImmediate);
  assert.equal(downloads, 2);
});

void test('auto road width follows the model area until the width is edited', () => {
  const { controller: c } = setup();

  c.modelSpan(5.09);
  assert.equal(c.getSnapshot().scene.roads.widthMm, 0.6, 'hidden roads keep their width');
  c.roads({ enabled: true });
  assert.equal(c.getSnapshot().scene.roads.widthMm, 0.5);
  c.modelSpan(20);
  assert.equal(c.getSnapshot().scene.roads.widthMm, 2);

  c.roads({ widthMm: 0.8, autoWidth: false });
  c.modelSpan(5.09);
  assert.equal(c.getSnapshot().scene.roads.widthMm, 0.8);

  c.roads({ autoWidth: true });
  assert.equal(c.getSnapshot().scene.roads.widthMm, 0.5);
});

void test('stills credit OpenStreetMap only while roads are drawn', async (t) => {
  const { controller: c } = setup(() =>
    Promise.resolve(Response.json({ elements: [roadElement(1)] })),
  );
  const credits = () => getSceneCredits(c.getSnapshot(), 'EU-DEM');

  stubBrowserTileDecoding(t);
  await c.loadTerrain();
  await c.selectView('3d');
  assert.deepEqual(credits(), ['EU-DEM'], 'roads off');

  c.roads({ enabled: true });
  assert.deepEqual(credits(), ['EU-DEM'], 'roads enabled before the network arrives');
  await new Promise(setImmediate);
  assert.equal(credits().length, 2);
  assert.match(credits()[1], /OpenStreetMap/);

  c.dimensions({ terrainShape: 'terraced' });
  assert.deepEqual(credits(), ['EU-DEM'], 'terraced models hide roads');
  c.dimensions({ terrainShape: 'smooth' });
  await c.selectView('2d');
  assert.deepEqual(credits(), ['EU-DEM'], 'the 2D view draws no roads');
});

void test('road status counts only the tunnels and bridges within the drawn detail', () => {
  const network = {
    roads: [{ id: 1, roadClass: 'primary' as const, points: [] }],
    omitted: [{ roadClass: 'track' as const, kind: 'bridge' as const }],
    detail: 'tracks' as const,
    fetchedAt: '',
    attribution: '',
  };

  assert.equal(
    describeRoadNetwork(network, { ...defaultRoadStyle, detail: 'major' }),
    '1 mapped road.',
  );
  assert.equal(
    describeRoadNetwork(network, { ...defaultRoadStyle, detail: 'tracks' }),
    '1 mapped road · 1 bridge and 0 tunnels hidden.',
  );
});

function roadElement(id: number) {
  return {
    type: 'way',
    id,
    tags: { highway: 'primary' },
    geometry: [
      { lat: 53, lon: -6 },
      { lat: 53.01, lon: -6 },
    ],
  };
}

const pngHeaders = { headers: { 'content-type': 'image/png' } };

/** Serves flat Terrarium tiles through the browser decoding path without a network or canvas. */
function stubBrowserTileDecoding(t: TestContext): void {
  const tileSizePixels = 256;
  const pixels = new Uint8ClampedArray(tileSizePixels * tileSizePixels * 4).fill(128);

  t.mock.method(globalThis, 'fetch', () => Promise.resolve(new Response('tile', pngHeaders)));
  Object.assign(globalThis, {
    createImageBitmap: () => Promise.resolve({ close: () => undefined }),
    document: {
      baseURI: 'https://landcube.test/',
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
  const changesBefore = frameChanges;

  c.frame({ finish: 'white' });
  assert.equal(c.getSnapshot().frame.assembly, tray);
  assert.equal(c.getSnapshot().frame.settings.finish, 'white');
  assert.ok(frameChanges > changesBefore);
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

void test('grass presets apply their look until a look value is set by hand', () => {
  const { controller: c } = setup();

  c.grass({ preset: 'autumn' });
  assert.equal(c.getSnapshot().scene.grass.preset, 'autumn');
  assert.equal(c.getSnapshot().scene.grass.tipColor, grassPresets.autumn.tipColor);

  c.grass({ bladesPerSquareCm: 400, wind: 0 });
  assert.equal(c.getSnapshot().scene.grass.preset, 'autumn');

  c.grass({ lengthMm: 2 });
  assert.equal(c.getSnapshot().scene.grass.preset, 'custom');
  assert.equal(c.getSnapshot().scene.grass.tipColor, grassPresets.autumn.tipColor);

  c.grass({ preset: 'alpine', lengthMm: 2 });
  assert.equal(c.getSnapshot().scene.grass.preset, 'custom');
  assert.equal(c.getSnapshot().scene.grass.lengthMm, 2);
  assert.equal(c.getSnapshot().scene.grass.baseColor, grassPresets.alpine.baseColor);
});

void test('downloading frame parts lists a job that runs queued, meshing, then done', async () => {
  const { controller: c, effects } = setup();
  const statusesSeen: string[] = [];

  effects.downloadFrameStl = () => {
    statusesSeen.push(...c.getSnapshot().exportJobs.map(({ status }) => status));
  };

  c.metrics(24);
  c.frame({ preset: 'tray' });
  const queued = c.downloadFrameStlParts(['frame']);

  assert.equal(c.getSnapshot().exportJobs[0].status, 'meshing');
  await queued;

  assert.deepEqual(statusesSeen, ['meshing']);
  const [job] = c.getSnapshot().exportJobs;

  assert.equal(job.label, 'frame STL');
  assert.equal(job.status, 'done');
  assert.equal(job.fraction, 1);
  assert.ok((job.sizeBytes ?? 0) > 84);
});

void test('a failing part download marks its job failed with the reason', async () => {
  const { controller: c, effects } = setup();

  effects.downloadFrameStl = () => {
    throw new Error('Mesh is open.');
  };

  c.metrics(24);
  c.frame({ preset: 'tray' });
  await c.downloadFrameStlParts(['frame']);

  assert.equal(c.getSnapshot().exportJobs[0].status, 'failed');
  assert.equal(c.getSnapshot().exportJobs[0].message, 'Mesh is open.');
});

void test('part downloads are skipped while a batch is still running', async () => {
  const { controller: c, effects } = setup();
  let downloads = 0;

  effects.downloadFrameStl = () => {
    downloads++;
  };

  c.metrics(24);
  c.frame({ preset: 'tray' });
  const first = c.downloadFrameStlParts(['frame']);

  await c.downloadFrameStlParts(['frame']);
  await first;
  assert.equal(downloads, 1);
});

void test('single downloads report whether they started', () => {
  const { controller: c, effects } = setup();

  assert.equal(c.downloadStl(), true);
  assert.equal(c.downloadFrameStl('frame'), false);

  effects.downloadStl = () => {
    throw new Error('No model yet.');
  };

  assert.equal(c.downloadStl(), false);
});
