import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { parseDesignParameters } from '../../design-settings';
import type { RealTerrain } from '../../real-terrain';
import { ControlGroup } from '../../ui/control-group';
import type { ControlGroupDefinition } from '../../ui/control-rows';
import { renderMarkup } from '../../ui/test-helpers';
import { createStudioController, type StudioController, type StudioState } from '../controller';
import { buildContourGroups } from './contours';

void test('2D procedural terrain shows density, appearance and index contours', () => {
  const { controller, state } = createContext();
  const groups = buildContourGroups(controller, state);

  assert.deepEqual(listGroupIds(groups), [
    'contour-density',
    'contour-appearance',
    'index-contours',
  ]);
  assert.deepEqual(listRowIds(groups, 'contour-density'), ['contourCount']);
  assert.deepEqual(listRowIds(groups, 'contour-appearance'), [
    'lineColor',
    'strokeOpacity',
    'strokeWidth',
  ]);
  assert.deepEqual(listRowIds(groups, 'index-contours'), [
    'indexStyle',
    'indexEvery',
    'indexStrokeWidth',
    'dashLength',
    'dashGap',
  ]);
});

void test('3D adds the contours-3d group, with groove rows only when engraved', () => {
  const drawn = createContext({ view: '3d' });

  assert.deepEqual(
    listGroupIds(buildContourGroups(drawn.controller, drawn.state)).at(-1),
    'contours-3d',
  );
  assert.deepEqual(listRowIds(buildContourGroups(drawn.controller, drawn.state), 'contours-3d'), [
    'contours-3d-lines',
    'contours-3d-treatment',
  ]);

  const engraved = createContext({ view: '3d', treatment: 'engraved' });

  assert.deepEqual(
    listRowIds(buildContourGroups(engraved.controller, engraved.state), 'contours-3d'),
    [
      'contours-3d-lines',
      'contours-3d-treatment',
      'contours-3d-groove-width',
      'contours-3d-groove-depth',
      'contours-3d-engraving-hint',
    ],
  );
});

void test('real terrain swaps density for the interval controls', () => {
  const { controller, state } = createContext({ terrain: true });
  const groups = buildContourGroups(controller, state);

  assert.deepEqual(listRowIds(groups, 'contour-density'), [
    'terrain-contour-mode',
    'terrain-contour-hint',
  ]);

  const fixed = createContext({ terrain: true, interval: 50 });

  assert.deepEqual(
    listRowIds(buildContourGroups(fixed.controller, fixed.state), 'contour-density'),
    ['terrain-contour-mode', 'terrain-contour-interval', 'terrain-contour-hint'],
  );
});

void test('binding ids render as the native control ids', () => {
  const { controller, state } = createContext({ view: '3d' });
  const markup = renderMarkup(
    buildContourGroups(controller, state).map((group) =>
      createElement(ControlGroup, { key: group.id, group }),
    ),
  );

  for (const id of ['contourCount', 'lineColor', 'strokeOpacity', 'strokeWidth', 'indexStyle']) {
    assert.match(markup, new RegExp(`id="${id}"`), `${id} is rendered`);
  }

  assert.match(markup, /<output[^>]*for="strokeWidth"/);
});

// === HELPERS ===

interface ContextOverrides {
  view?: '2d' | '3d';
  terrain?: boolean;
  /** A fixed interval in metres; automatic when omitted. */
  interval?: number;
  treatment?: 'drawn' | 'engraved';
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
      workspace: { ...initial.workspace, view: overrides.view ?? '2d' },
      source: {
        ...initial.source,
        // The builder reads the terrain only through `getRealContourInterval`, which needs these fields.
        terrain: overrides.terrain === true ? createTerrainStub() : undefined,
        interval: overrides.interval ?? 'auto',
      },
      scene: {
        ...initial.scene,
        engraving: { ...initial.scene.engraving, treatment: overrides.treatment ?? 'drawn' },
      },
    },
  };
}

function createTerrainStub(): RealTerrain {
  return { contourInterval: 100 } as unknown as RealTerrain;
}

function listGroupIds(groups: readonly ControlGroupDefinition[]): string[] {
  return groups.map((group) => group.id);
}

function listRowIds(groups: readonly ControlGroupDefinition[], groupId: string): string[] {
  const group = groups.find((candidate) => candidate.id === groupId);

  assert.ok(group, `group ${groupId} is built`);

  return group.rows.flatMap((row) => (row === false || row === undefined ? [] : [row.id]));
}
