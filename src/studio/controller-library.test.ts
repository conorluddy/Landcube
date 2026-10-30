import assert from 'node:assert/strict';
import test from 'node:test';
import { versionOneDesignDefaults } from '../constants/design';
import { getDesignUrl, validateDesignSettings } from '../design-settings';
import type { SavedDesign } from '../saved-designs';
import { serializeRouteGpx } from '../gpx-export';
import { toSavedRoute } from '../saved-designs';
import { createStudioController } from './controller';

const parsedSettings = validateDesignSettings(versionOneDesignDefaults);

assert.ok(parsedSettings.ok);
const settings = parsedSettings.data;

function setupController() {
  return createStudioController({
    getSettings: () => settings,
    updateSettings: () => true,
    newLandscape: () => undefined,
    isSeedLocked: false,
    lockSeed: () => undefined,
    getShareUrl: () => '',
    copyLink: () => Promise.resolve({ ok: true, data: undefined }),
  });
}

const link = getDesignUrl('https://landcube.test/', settings);
const route = {
  version: 1,
  id: 'route-1',
  name: 'Ridge',
  provenance: 'drawn',
  points: [
    { latitude: 55.01, longitude: -8.14 },
    { latitude: 55.02, longitude: -8.13 },
  ],
  namedWaypoints: [],
  slopeThresholdPercent: 20,
} as const;

function saved(extra: Partial<SavedDesign>): SavedDesign {
  return {
    id: '1',
    name: 'Saved',
    savedAt: '2026-01-01T00:00:00.000Z',
    link,
    thumbnailSvg: null,
    source: 'real',
    seedOrPlace: 'Place',
    ...extra,
  };
}

void test('restoring waits for the terrain load before installing the route', async () => {
  const c = setupController();
  const realFetch = globalThis.fetch;
  let failFetch: () => void = () => undefined;

  globalThis.fetch = () =>
    new Promise<Response>((_resolve, reject) => {
      failFetch = () => {
        reject(new Error('offline'));
      };
    });

  try {
    const restoring = c.restoreSavedDesign(
      saved({
        terrain: { latitude: 55.01, longitude: -8.14, spanKm: 12, maxDepth: 40 },
        route: { ...route, points: [...route.points], namedWaypoints: [] },
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(c.getSnapshot().source.latitude, 55.01);
    assert.equal(c.getSnapshot().source.loading, true);
    assert.equal(c.getSnapshot().workspace.route, null);

    failFetch();
    assert.deepEqual(await restoring, { ok: true, data: undefined });

    // The load failed, so the fault is surfaced and the route is still restored.
    assert.notEqual(c.getSnapshot().source.fault, null);
    assert.equal(c.getSnapshot().workspace.route?.active.id, 'route-1');
    assert.equal(c.getSnapshot().workspace.route?.active.slopeThresholdPercent, 20);
    assert.deepEqual(c.getSnapshot().workspace.route?.editing, { mode: 'viewing' });
  } finally {
    globalThis.fetch = realFetch;
  }
});

void test('restoring a design without a route leaves the current route alone', async () => {
  const c = setupController();

  c.setRoute({
    id: 'route-1',
    name: 'Ridge',
    provenance: 'drawn',
    waypoints: [...route.points],
    namedWaypoints: [],
    slopeThresholdPercent: 20,
  });

  assert.deepEqual(await c.restoreSavedDesign(saved({ source: 'procedural' })), {
    ok: true,
    data: undefined,
  });
  assert.equal(c.getSnapshot().workspace.route?.active.id, 'route-1');
});

void test('an invalid saved link is reported and restores nothing', async () => {
  const c = setupController();
  const result = await c.restoreSavedDesign(
    saved({ link: 'not a url', route: { ...route, points: [], namedWaypoints: [] } }),
  );

  assert.equal(result.ok, false);
  assert.equal(c.getSnapshot().workspace.route, null);
});

void test('design links carry no route or location data', () => {
  const url = new URL(link);

  assert.equal(url.searchParams.get('v'), '1');

  for (const key of ['route', 'waypoints', 'lat', 'latitude', 'lon', 'longitude', 'span']) {
    assert.equal(url.searchParams.has(key), false, key);
  }
});

void test('an imported route keeps its recorded elevations through save and restore', async () => {
  const source = setupController();
  const gpx = `<gpx><trk><name>Ridge</name><trkseg>
    <trkpt lat="55" lon="-8"><ele>10.5</ele></trkpt>
    <trkpt lat="55.01" lon="-7.98"><ele>30</ele></trkpt>
    <trkpt lat="55.02" lon="-8"><ele>25.25</ele></trkpt></trkseg></trk></gpx>`;

  source.loadRoute(gpx);
  const original = source.getSnapshot().workspace.route?.active;

  assert.ok(original);
  const stored = JSON.parse(JSON.stringify(toSavedRoute(original))) as SavedDesign['route'];
  const restored = setupController();

  await restored.restoreSavedDesign(saved({ source: 'procedural', route: stored }));
  const active = restored.getSnapshot().workspace.route?.active;

  assert.ok(active);
  assert.deepEqual(
    [...serializeRouteGpx(active).matchAll(/<ele>([^<]*)<\/ele>/g)].map((match) => match[1]),
    [...serializeRouteGpx(original).matchAll(/<ele>([^<]*)<\/ele>/g)].map((match) => match[1]),
  );
});

void test('restoring real terrain also restores the place name', async () => {
  const c = setupController();
  const realFetch = globalThis.fetch;

  globalThis.fetch = () => Promise.reject(new Error('offline'));

  try {
    await c.restoreSavedDesign(
      saved({ terrain: { latitude: 1, longitude: 2, spanKm: 5, place: 'Snowdon' } }),
    );
    assert.equal(c.getSnapshot().source.place, 'Snowdon');
  } finally {
    globalThis.fetch = realFetch;
  }
});
