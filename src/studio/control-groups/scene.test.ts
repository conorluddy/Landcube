import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { parseDesignParameters } from '../../design-settings';
import type { RealTerrain } from '../../real-terrain';
import { ControlGroup } from '../../ui/control-group';
import type { ControlGroupDefinition } from '../../ui/control-rows';
import { renderMarkup } from '../../ui/test-helpers';
import type { OperationError } from '../../types/operations';
import {
  createStudioController,
  type StudioController,
  type StudioState,
  type WorkspaceRoute,
} from '../controller';
import { getGroupCode } from '../sections';
import { buildOverlayPopoverGroups } from './overlays';
import { buildSceneGroups } from './scene';

const realTerrain = { attribution: 'Test credit' } as RealTerrain;

void test('2D scene shows cursor interaction only, leaving the rest of SCEN as gaps', () => {
  const { controller, state } = createContext({ view: '2d' });
  const groups = buildSceneGroups(controller, state);

  assert.deepEqual(listGroupIds(groups), ['cursor-interaction']);
  assert.deepEqual(listRowIds(groups, 'cursor-interaction'), [
    'cursorEnabled',
    'cursorRadius',
    'cursorHeight',
    'cursorResponseMs',
    'cursor-interaction-hint',
  ]);
});

void test('3D scene shows surface, grass, ground, water and lighting with their codes', () => {
  const { controller, state } = createContext({ view: '3d' });
  const groups = buildSceneGroups(controller, state);

  assert.deepEqual(listGroupIds(groups), ['surface', 'grass', 'ground', 'water', 'lighting']);
  assert.deepEqual(
    groups.map((group) => getGroupCode(group.id)),
    ['SCEN.02', 'SCEN.03', 'SCEN.04', 'SCEN.05', 'SCEN.06'],
  );
});

void test('lighting keeps the terrain-light-time slider with its formatted output', () => {
  const { controller, state } = createContext({ view: '3d' });
  const groups = buildSceneGroups(controller, state);
  const markup = renderGroups(groups);

  assert.ok(listRowIds(groups, 'lighting').includes('terrain-light-time'));
  assert.match(markup, /<output[^>]*for="terrain-light-time"/);
  assert.match(markup, /id="terrain-light-haze"/);
});

void test('the preview water level slider appears only while previewing', () => {
  const idle = createContext({ view: '3d' });
  const previewing = createContext({ view: '3d', scene: { previewWater: true } });

  assert.ok(
    !listRowIds(buildSceneGroups(idle.controller, idle.state), 'water').includes(
      'scene-water-level',
    ),
  );
  assert.ok(
    listRowIds(buildSceneGroups(previewing.controller, previewing.state), 'water').includes(
      'scene-water-level',
    ),
  );
});

void test('2D overlays show grid and summit markers, plus sea level and route on real terrain', () => {
  const generated = createContext({ view: '2d' });
  const real = createContext({ view: '2d', terrain: realTerrain });

  assert.deepEqual(listGroupIds(buildOverlayPopoverGroups(generated.controller, generated.state)), [
    'decorative-grid',
    'summit-markers',
  ]);
  assert.deepEqual(listGroupIds(buildOverlayPopoverGroups(real.controller, real.state)), [
    'decorative-grid',
    'summit-markers',
    'sea-level',
    'route',
  ]);
});

void test('3D overlays show geographic decorations and roads, plus sea level and route on real terrain', () => {
  const generated = createContext({ view: '3d' });
  const real = createContext({ view: '3d', terrain: realTerrain });

  assert.deepEqual(listGroupIds(buildOverlayPopoverGroups(generated.controller, generated.state)), [
    'geographic-decorations',
    'roads',
  ]);
  assert.deepEqual(listGroupIds(buildOverlayPopoverGroups(real.controller, real.state)), [
    'geographic-decorations',
    'roads',
    'sea-level',
    'route',
  ]);
});

void test('roads status is always mounted and focusable, even when empty', () => {
  const { controller, state } = createContext({ view: '3d', terrain: realTerrain });
  const roads = buildOverlayPopoverGroups(controller, state).filter(
    (group) => group.id === 'roads',
  );
  const status = roads[0].rows.find((row) => row !== false && row?.id === 'roads-status');

  assert.ok(status !== undefined && status !== false && status.kind === 'status');
  assert.equal(status.isAlwaysMounted, true);
  assert.equal(status.tabIndex, -1);
  assert.match(renderGroups(roads), /<div[^>]*role="status"[^>]*tabindex="-1"/);
});

void test('roads without a real location say so', () => {
  const { controller, state } = createContext({ view: '3d' });

  assert.match(
    renderGroups(buildOverlayPopoverGroups(controller, state)),
    /Roads need a real location\./,
  );
});

void test('the retry button appears only for enabled roads that can be retried', () => {
  const retryable = createContext({
    view: '3d',
    terrain: realTerrain,
    roads: { isEnabled: true, canRetry: true },
  });
  const idle = createContext({ view: '3d', terrain: realTerrain });

  assert.ok(
    listRowIds(buildOverlayPopoverGroups(retryable.controller, retryable.state), 'roads').includes(
      'roads-retry',
    ),
  );
  assert.ok(
    !listRowIds(buildOverlayPopoverGroups(idle.controller, idle.state), 'roads').includes(
      'roads-retry',
    ),
  );
});

void test('the route group offers a GPX file input, a disabled toggle and a disabled clear before a route loads', () => {
  const { controller, state } = createContext({ view: '2d', terrain: realTerrain });
  const groups = buildOverlayPopoverGroups(controller, state);
  const markup = renderGroups(groups.filter((group) => group.id === 'route'));

  assert.deepEqual(listRowIds(groups, 'route'), [
    'route-file',
    'route-visible',
    'route-draw',
    'route-edit',
    'route-finish',
    'route-reverse',
    'route-export',
    'route-clear',
    'route-hint',
  ]);
  assert.equal(getGroupCode('route'), 'SCEN.12');
  assert.match(markup, /type="file"[^>]*accept="[^"]*\.gpx/);
  assert.match(markup, /GPX file/);
  assert.match(markup, /<button[^>]*disabled[^>]*><span[^>]*>Clear route/);
});

void test('a loaded route shows its stats and a refused file shows an E-206 fault', () => {
  const loaded = createContext({
    view: '2d',
    terrain: realTerrain,
    route: {
      active: {
        id: 'imported-test',
        name: 'Ridge walk',
        provenance: 'imported',
        waypoints: [
          { latitude: 55, longitude: -8 },
          { latitude: 55.1, longitude: -8 },
        ],
        namedWaypoints: [],
        slopeThresholdPercent: 15,
      },
      editing: { mode: 'viewing' },
      stats: { distanceKm: 11.1, recordedPointCount: 9 },
      isVisible: true,
    },
  });
  const faulted = createContext({
    view: '2d',
    terrain: realTerrain,
    routeFault: { code: 'INVALID_ROUTE', message: 'Bad file.', retryable: false },
  });
  const loadedGroups = buildOverlayPopoverGroups(loaded.controller, loaded.state);
  const faultedMarkup = renderGroups(
    buildOverlayPopoverGroups(faulted.controller, faulted.state).filter(
      (group) => group.id === 'route',
    ),
  );

  assert.ok(listRowIds(loadedGroups, 'route').includes('route-stats'));
  assert.match(renderGroups(loadedGroups), /Ridge walk · 11\.1 km ground · Terrain-derived/);
  assert.match(faultedMarkup, /E-206/);
  assert.match(faultedMarkup, /Bad file\./);
});

// === HELPERS ===

interface ContextOverrides {
  route?: WorkspaceRoute;
  routeFault?: OperationError;
  view: '2d' | '3d';
  terrain?: RealTerrain;
  scene?: Partial<StudioState['scene']>;
  roads?: { isEnabled: boolean; canRetry: boolean };
}

function createContext(overrides: ContextOverrides): {
  controller: StudioController;
  state: StudioState;
} {
  const parsed = parseDesignParameters(new URLSearchParams('v=1&seed=123'));

  assert.ok(parsed.ok);
  const design = parsed.data.settings;
  const controller = createStudioController({
    getSettings: () => design,
    updateSettings: () => true,
    newLandscape: () => undefined,
    isSeedLocked: false,
    lockSeed: () => undefined,
    getShareUrl: () => 'https://landcu.be.test/',
    copyLink: () => Promise.resolve({ ok: true, data: undefined }),
  });
  const initial = controller.getSnapshot();

  return {
    controller,
    state: {
      ...initial,
      workspace: {
        ...initial.workspace,
        view: overrides.view,
        route: overrides.route ?? null,
        routeFault: overrides.routeFault ?? null,
      },
      source: { ...initial.source, terrain: overrides.terrain },
      scene: {
        ...initial.scene,
        ...overrides.scene,
        roads: { ...initial.scene.roads, enabled: overrides.roads?.isEnabled ?? false },
      },
      roads: { ...initial.roads, canRetry: overrides.roads?.canRetry ?? false },
    },
  };
}

function listGroupIds(groups: readonly ControlGroupDefinition[]): string[] {
  return groups.map((group) => group.id);
}

function listRowIds(groups: readonly ControlGroupDefinition[], groupId: string): string[] {
  const group = groups.find((candidate) => candidate.id === groupId);

  assert.ok(group, `group ${groupId} is built`);

  return group.rows.flatMap((row) => (row === false || row === undefined ? [] : [row.id]));
}

function renderGroups(groups: readonly ControlGroupDefinition[]): string {
  return renderMarkup(groups.map((group) => createElement(ControlGroup, { key: group.id, group })));
}
