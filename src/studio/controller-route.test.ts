import assert from 'node:assert/strict';
import test from 'node:test';
import { versionOneDesignDefaults } from '../constants/design';
import { validateDesignSettings } from '../design-settings';
import { maximumRoutePoints } from '../gpx';
import { createStudioController } from './controller';

const point = (latitude: number, longitude = 0) => ({ latitude, longitude });

function setupController() {
  const settings = validateDesignSettings(versionOneDesignDefaults);

  assert.ok(settings.ok);

  return createStudioController({
    getSettings: () => settings.data,
    updateSettings: () => true,
    newLandscape: () => undefined,
    isSeedLocked: false,
    lockSeed: () => undefined,
    getShareUrl: () => '',
    copyLink: () => Promise.resolve({ ok: true, data: undefined }),
  });
}

function gpx(points: string, name = 'Ridge'): string {
  return `<gpx><trk><name>${name}</name><trkseg>${points}</trkseg></trk><wpt lat="1" lon="0"><name>Hut</name></wpt></gpx>`;
}

const twoPoints = gpx(
  '<trkpt lat="0" lon="0"><ele>10</ele></trkpt><trkpt lat="0.01" lon="0"><ele>30</ele></trkpt>',
);

void test('loading GPX keeps recorded points with elevation and a simplified display copy', () => {
  const c = setupController();

  assert.deepEqual(c.loadRoute(twoPoints), { needsConfirmation: false });

  const route = c.getSnapshot().workspace.route;

  assert.equal(route?.active.provenance, 'imported');
  assert.equal(route.active.originalPoints?.[1].elevationMeters, 30);
  assert.equal(route.active.waypoints.length, 2);
  assert.equal(route.active.namedWaypoints[0].name, 'Hut');
  assert.equal(route.stats?.ascentMeters, 20);
  assert.deepEqual(route.editing, { mode: 'viewing' });
});

void test('the same GPX text always gets the same route id', () => {
  const [a, b] = [setupController(), setupController()];

  a.loadRoute(twoPoints);
  b.loadRoute(twoPoints);

  assert.equal(
    a.getSnapshot().workspace.route?.active.id,
    b.getSnapshot().workspace.route?.active.id,
  );
});

void test('the display copy of a dense wiggly track stays within the point cap', () => {
  const dense = Array.from(
    { length: 6000 },
    (_, index) => `<trkpt lat="${index * 0.00005}" lon="${index % 2 === 0 ? 0 : 0.0005}"></trkpt>`,
  ).join('');
  const c = setupController();

  c.loadRoute(gpx(dense));

  const route = c.getSnapshot().workspace.route;

  assert.ok((route?.active.waypoints.length ?? Infinity) <= maximumRoutePoints);
  assert.equal(route?.active.originalPoints?.length, 6000);
});

void test('loading over an existing route asks first and cancelling keeps the original', () => {
  const c = setupController();

  c.loadRoute(twoPoints);

  const original = c.getSnapshot().workspace.route?.active.id;

  assert.deepEqual(c.loadRoute(gpx('<trkpt lat="5" lon="5"/><trkpt lat="6" lon="6"/>', 'New')), {
    needsConfirmation: true,
  });
  assert.equal(c.getSnapshot().workspace.route?.active.id, original);
  assert.equal(c.getSnapshot().workspace.routeReplacement?.kind, 'import');

  c.cancelRouteReplacement();

  assert.equal(c.getSnapshot().workspace.routeReplacement, null);
  assert.equal(c.getSnapshot().workspace.route?.active.id, original);
});

void test('confirming a pending import replaces the route', () => {
  const c = setupController();

  c.loadRoute(twoPoints);
  c.loadRoute(gpx('<trkpt lat="5" lon="5"/><trkpt lat="6" lon="6"/>', 'New'));
  c.confirmRouteReplacement();

  assert.equal(c.getSnapshot().workspace.route?.active.name, 'New');
  assert.equal(c.getSnapshot().workspace.routeReplacement, null);
});

void test('confirming a pending drawing starts it in the Route tool', () => {
  const c = setupController();

  c.loadRoute(twoPoints);

  assert.deepEqual(c.startRouteDrawing(), { needsConfirmation: true });

  c.confirmRouteReplacement();

  const { route, toolMode } = c.getSnapshot().workspace;

  assert.equal(route?.active.provenance, 'drawn');
  assert.equal(route.active.waypoints.length, 0);
  assert.equal(toolMode, 'route');
});

void test('an invalid file faults without disturbing the current route', () => {
  const c = setupController();

  c.loadRoute(twoPoints);

  assert.deepEqual(c.loadRoute('<nope/>'), { needsConfirmation: false });
  assert.ok(c.getSnapshot().workspace.routeFault);
  assert.equal(c.getSnapshot().workspace.route?.active.name, 'Ridge');
});

void test('drawing, finishing and editing flow through controller actions', () => {
  const c = setupController();
  const waypoints = () => c.getSnapshot().workspace.route?.active.waypoints.length;

  // An empty drawn route has nothing to lose, so no confirmation is needed.
  assert.deepEqual(c.startRouteDrawing(), { needsConfirmation: false });
  c.placeRouteWaypoint(point(1));
  c.placeRouteWaypoint(point(3));
  c.insertRouteWaypoint(0, point(2));
  assert.equal(waypoints(), 3);
  c.selectRouteWaypoint(1);
  c.deleteRouteWaypoint();
  assert.equal(waypoints(), 2);
  c.finishRoute();
  assert.deepEqual(c.getSnapshot().workspace.route?.editing, { mode: 'viewing' });
  c.editRoute();
  assert.deepEqual(c.getSnapshot().workspace.route?.editing, { mode: 'editing' });
  c.reverseRoute();
  assert.equal(c.getSnapshot().workspace.route?.active.waypoints[0].latitude, 3);
  c.setRouteSlopeThreshold(500);
  assert.equal(c.getSnapshot().workspace.route?.active.slopeThresholdPercent, 100);
  c.inspectRoute(120);
  assert.equal(c.getSnapshot().workspace.route?.inspectedDistanceMeters, 120);
  c.inspectRoute(undefined);
  assert.equal(c.getSnapshot().workspace.route?.inspectedDistanceMeters, undefined);
  c.clearRoute();
  assert.equal(c.getSnapshot().workspace.route, null);
});

void test('editing an imported route drops its recorded stats and points', () => {
  const c = setupController();

  c.loadRoute(twoPoints);
  c.editRoute();
  c.moveRouteWaypoint(0, point(0.5));

  const route = c.getSnapshot().workspace.route;

  assert.equal(route?.active.provenance, 'drawn');
  assert.equal(route.stats, undefined);
});

void test('scrubbing the profile reuses the recorded stats', () => {
  const c = setupController();

  c.loadRoute(twoPoints);

  const stats = c.getSnapshot().workspace.route?.stats;

  c.inspectRoute(5);

  assert.equal(c.getSnapshot().workspace.route?.inspectedDistanceMeters, 5);
  assert.equal(c.getSnapshot().workspace.route?.stats, stats);
});
