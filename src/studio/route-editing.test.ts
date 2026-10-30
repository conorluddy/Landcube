import assert from 'node:assert/strict';
import test from 'node:test';
import {
  emptyRouteEditingState,
  isRouteComplete,
  reduceRouteEditing,
  type RouteEditingAction,
  type RouteEditingState,
} from './route-editing';
import type { ActiveRoute, GeoPoint } from '../types/terrain-analysis';

const at = (latitude: number, longitude = 0): GeoPoint => ({ latitude, longitude });

function run(...actions: RouteEditingAction[]): RouteEditingState {
  return actions.reduce(reduceRouteEditing, emptyRouteEditingState);
}

const drawn = (...latitudes: number[]): RouteEditingAction[] => [
  { type: 'start-drawing', id: 'r1' },
  ...latitudes.map((latitude): RouteEditingAction => ({ type: 'place', point: at(latitude) })),
];

function waypointLatitudes(state: RouteEditingState): number[] {
  return state.route?.waypoints.map((point) => point.latitude) ?? [];
}

void test('start-drawing creates an empty drawn route with the default threshold', () => {
  const { route, editing } = run({ type: 'start-drawing', id: 'r1' });

  assert.equal(route?.provenance, 'drawn');
  assert.equal(route.slopeThresholdPercent, 15);
  assert.deepEqual(editing, { mode: 'drawing' });
});

void test('placing in drawing mode appends waypoints in order', () => {
  assert.deepEqual(waypointLatitudes(run(...drawn(1, 2, 3))), [1, 2, 3]);
});

void test('placing while viewing is ignored', () => {
  const state = run(...drawn(1, 2), { type: 'finish' }, { type: 'place', point: at(9) });

  assert.deepEqual(waypointLatitudes(state), [1, 2]);
});

void test('dragging moves one waypoint and selects it', () => {
  const state = run(...drawn(1, 2, 3), { type: 'drag', index: 1, point: at(7) });

  assert.deepEqual(waypointLatitudes(state), [1, 7, 3]);
  assert.deepEqual(state.editing, { mode: 'drawing', selectedIndex: 1 });
});

void test('inserting on a segment adds a waypoint between its ends', () => {
  const state = run(...drawn(1, 3), { type: 'insert', segmentIndex: 0, point: at(2) });

  assert.deepEqual(waypointLatitudes(state), [1, 2, 3]);
});

void test('inserting past the last segment is ignored', () => {
  const state = run(...drawn(1, 3), { type: 'insert', segmentIndex: 1, point: at(2) });

  assert.deepEqual(waypointLatitudes(state), [1, 3]);
});

void test('deleting removes the selected waypoint and clears the selection', () => {
  const state = run(...drawn(1, 2, 3), { type: 'select', index: 1 }, { type: 'delete' });

  assert.deepEqual(waypointLatitudes(state), [1, 3]);
  assert.deepEqual(state.editing, { mode: 'drawing' });
});

void test('deleting with nothing selected changes nothing', () => {
  const before = run(...drawn(1, 2), { type: 'select', index: undefined });

  assert.deepEqual(reduceRouteEditing(before, { type: 'delete' }), before);
});

void test('selecting an out-of-range index is ignored', () => {
  const before = run(...drawn(1, 2));

  assert.deepEqual(reduceRouteEditing(before, { type: 'select', index: 5 }), before);
});

void test('finish returns to viewing and edit re-enters editing', () => {
  const finished = run(...drawn(1, 2), { type: 'finish' });
  const editing = reduceRouteEditing(finished, { type: 'edit' });

  assert.deepEqual(finished.editing, { mode: 'viewing' });
  assert.deepEqual(editing.editing, { mode: 'editing' });
});

void test('a route with fewer than two waypoints is kept but incomplete', () => {
  const state = run(...drawn(1), { type: 'finish' });

  assert.ok(state.route);
  assert.equal(isRouteComplete(state.route), false);
  assert.deepEqual(reduceRouteEditing(state, { type: 'edit' }), state);
});

void test('escape leaves drawing but retains the route', () => {
  const state = run(...drawn(1, 2), { type: 'escape' });

  assert.deepEqual(waypointLatitudes(state), [1, 2]);
  assert.deepEqual(state.editing, { mode: 'viewing' });
});

void test('reverse flips waypoints and recorded points together', () => {
  const imported: RouteEditingState = { route: importedRoute(), editing: { mode: 'viewing' } };
  const { route } = reduceRouteEditing(imported, { type: 'reverse' });

  assert.deepEqual(
    route?.waypoints.map((point) => point.latitude),
    [3, 2, 1],
  );
  assert.deepEqual(
    route.originalPoints?.map((point) => point.elevationMeters),
    [30, 20, 10],
  );
  assert.equal(route.provenance, 'imported');
});

void test('editing geometry of an imported route makes it drawn and drops recorded points', () => {
  const imported: RouteEditingState = { route: importedRoute(), editing: { mode: 'editing' } };
  const { route } = reduceRouteEditing(imported, { type: 'drag', index: 0, point: at(9) });

  assert.equal(route?.provenance, 'drawn');
  assert.equal(route.originalPoints, undefined);
});

void test('clear removes the route', () => {
  assert.deepEqual(run(...drawn(1, 2), { type: 'clear' }), emptyRouteEditingState);
});

void test('slope threshold clamps to 1..100 and ignores non-numbers', () => {
  const base = run(...drawn(1, 2));
  const percent = (value: number) =>
    reduceRouteEditing(base, { type: 'set-threshold', percent: value }).route
      ?.slopeThresholdPercent;

  assert.equal(percent(0), 1);
  assert.equal(percent(250), 100);
  assert.equal(percent(22), 22);
  assert.equal(percent(Number.NaN), 15);
});

function importedRoute(): ActiveRoute {
  return {
    id: 'imported-1',
    name: 'Ridge',
    provenance: 'imported',
    waypoints: [at(1), at(2), at(3)],
    originalPoints: [
      { latitude: 1, longitude: 0, elevationMeters: 10 },
      { latitude: 2, longitude: 0, elevationMeters: 20 },
      { latitude: 3, longitude: 0, elevationMeters: 30 },
    ],
    namedWaypoints: [],
    slopeThresholdPercent: 15,
  };
}

void test('finishing or escaping an empty drawing discards it', () => {
  assert.equal(run(...drawn(), { type: 'escape' }).route, null);
  assert.equal(run(...drawn(), { type: 'finish' }).route, null);
});
