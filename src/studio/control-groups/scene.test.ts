import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { parseDesignParameters } from '../../design-settings';
import type { RealTerrain } from '../../real-terrain';
import { ControlGroup } from '../../ui/control-group';
import type { ControlGroupDefinition } from '../../ui/control-rows';
import { renderMarkup } from '../../ui/test-helpers';
import { createStudioController, type StudioController, type StudioState } from '../controller';
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

void test('2D overlays show grid and summit markers, plus sea level on real terrain', () => {
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
  ]);
});

void test('3D overlays show geographic decorations and roads, plus sea level on real terrain', () => {
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

// === HELPERS ===

interface ContextOverrides {
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
      workspace: { ...initial.workspace, view: overrides.view },
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
