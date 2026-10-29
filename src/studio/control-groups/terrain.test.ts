import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { parseDesignParameters } from '../../design-settings';
import type { RealTerrain } from '../../real-terrain';
import { ControlGroup } from '../../ui/control-group';
import type { ControlGroupDefinition } from '../../ui/control-rows';
import { renderMarkup } from '../../ui/test-helpers';
import { createStudioController, type StudioController, type StudioState } from '../controller';
import { buildTerrainGroups } from './terrain';

void test('generated terrain shows autoplay and procedural landscape only', () => {
  const { controller, state } = createContext();
  const groups = buildTerrainGroups(controller, state);

  assert.deepEqual(listGroupIds(groups), ['autoplay', 'procedural-landscape']);
  assert.deepEqual(listRowIds(groups, 'autoplay'), ['autoplay-enabled', 'daylight-cycle-enabled']);
  assert.deepEqual(listRowIds(groups, 'procedural-landscape'), [
    'seed-readout',
    'lock-seed',
    'new-landscape',
    'featureScale',
    'detail',
  ]);
});

void test('the seed readout keeps its output id inside the hint', () => {
  const { controller, state } = createContext();
  const markup = renderGroups(buildTerrainGroups(controller, state));

  assert.match(markup, /<output id="seed-value">123<\/output>/);
});

void test('real terrain shows autoplay and real location with the legacy field ids', () => {
  const { controller, state } = createContext({ selected: 'real' });
  const groups = buildTerrainGroups(controller, state);

  assert.deepEqual(listGroupIds(groups), ['autoplay', 'real-location']);
  assert.deepEqual(listRowIds(groups, 'real-location'), [
    'terrain-place-search',
    'terrain-place',
    'terrain-coordinates',
    'terrain-span',
    'terrain-max-depth',
    'terrain-elevation-floor',
    'terrain-elevation-hint',
    'load-terrain',
    'terrain-empty',
    'terrain-status',
    'terrain-session-hint',
    'terrain-sources-link',
  ]);

  const markup = renderGroups(groups);

  for (const id of ['terrain-place', 'terrain-latitude', 'terrain-longitude', 'terrain-span']) {
    assert.match(markup, new RegExp(`id="${id}"`), `${id} is rendered`);
  }

  assert.match(markup, /class="sidebar-place-search"/);
  assert.match(markup, /role="status"/);
});

void test('autoplay and daylight sliders appear only while their toggles are on', () => {
  const { controller, state } = createContext({
    autoplay: { enabled: true, delaySeconds: 10 },
    daylightEnabled: true,
  });

  assert.deepEqual(listRowIds(buildTerrainGroups(controller, state), 'autoplay'), [
    'autoplay-enabled',
    'autoplay-delay',
    'daylight-cycle-enabled',
    'daylight-day-length',
  ]);
});

void test('loaded real terrain adds its attribution hint', () => {
  const { controller, state } = createContext({
    selected: 'real',
    // The builder reads only `attribution`.
    terrain: { attribution: 'Test credit' } as RealTerrain,
  });
  const groups = buildTerrainGroups(controller, state);

  assert.ok(listRowIds(groups, 'real-location').includes('terrain-attribution'));
  assert.match(renderGroups(groups), /Test credit/);
});

// === HELPERS ===

interface ContextOverrides {
  selected?: 'generated' | 'real';
  terrain?: RealTerrain;
  autoplay?: { enabled: boolean; delaySeconds: number };
  daylightEnabled?: boolean;
}

function createContext(overrides: ContextOverrides = {}): {
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
      source: {
        ...initial.source,
        selected: overrides.selected ?? 'generated',
        terrain: overrides.terrain,
        autoplay: overrides.autoplay ?? initial.source.autoplay,
      },
      scene: {
        ...initial.scene,
        daylightCycle: {
          ...initial.scene.daylightCycle,
          enabled: overrides.daylightEnabled ?? false,
        },
      },
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
