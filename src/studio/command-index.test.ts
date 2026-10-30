import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDesignParameters } from '../design-settings';
import type { DesignSettings } from '../types/design';
import type { ControlRowKind } from '../ui/control-rows';
import { buildCommandIndex, buildLocationCommands, buildParameterCommands } from './command-index';
import { controlGroupBuilders } from './control-groups';
import {
  createStudioController,
  threeDOnlySections,
  type StudioController,
  type StudioState,
  type StudioView,
} from './controller';
import type { RealTerrain } from '../real-terrain';
import { getSectionForGroup } from './sections';

void test('the index lists every value row the builders emit, in 2D and 3D', () => {
  const { controller } = createTestController();

  for (const view of ['2d', '3d'] as const) {
    for (const selected of ['generated', 'real'] as const) {
      const state = withView(controller.getSnapshot(), view, selected);
      const indexedIds = buildParameterCommands(controller, state).map(({ id }) => id);

      assert.deepEqual(
        [...indexedIds].sort(),
        listBuilderValueRowIds(controller, state).sort(),
        `${view} ${selected}`,
      );
      assert.equal(
        new Set(indexedIds).size,
        indexedIds.length,
        `${view} ${selected}: duplicate id`,
      );
    }
  }
});

void test('2D drops the 3D-only sections; 3D adds them', () => {
  const { controller } = createTestController();
  const ids2d = buildParameterCommands(controller, withView(controller.getSnapshot(), '2d'));
  const ids3d = buildParameterCommands(controller, withView(controller.getSnapshot(), '3d'));

  assert.ok(ids2d.some(({ id }) => id === 'contourCount'));
  assert.ok(!ids2d.some(({ sectionId }) => threeDOnlySections.includes(sectionId)));
  assert.ok(ids3d.some(({ id }) => id === 'contours-3d-lines'));
  assert.ok(ids3d.some(({ sectionId }) => sectionId === 'Camera'));
});

void test('a parameter carries its group code, section and formatted current value', () => {
  const { controller } = createTestController();
  const opacity = findParameter(controller, 'strokeOpacity');

  assert.equal(opacity.code, 'CONT.02');
  assert.equal(opacity.sectionId, 'Contours');
  assert.equal(opacity.rowKind, 'range');
  assert.equal(opacity.current, '0.29');
  assert.equal(opacity.detail, '0.29');
  assert.equal(findParameter(controller, 'strokeWidth').current.endsWith(' px'), true);
});

void test('applying a parameter goes through the row callback', () => {
  const { controller, updates } = createTestController();
  const result = findParameter(controller, 'strokeOpacity').apply('0.5');

  assert.deepEqual(result, { ok: true, data: undefined });
  assert.equal(updates.at(-1)?.strokeOpacity, 0.5);
});

void test('an out-of-range value is rejected without calling the row', () => {
  const { controller, updates } = createTestController();
  const result = findParameter(controller, 'strokeOpacity').apply('7');

  assert.ok(!result.ok);
  assert.match(result.error.message, /Opacity takes 0.05 to 1; got "7"/);
  assert.equal(updates.length, 0);
});

void test('overlays parameters are marked so the palette opens the popover', () => {
  const { controller } = createTestController();

  assert.equal(findParameter(controller, 'gridStyle').isInOverlays, true);
  assert.equal(findParameter(controller, 'contourCount').isInOverlays, false);
});

void test('actions cover the view, panels, style, presets and section jumps', () => {
  const { controller } = createTestController();
  const actions = buildCommandIndex(controller, controller.getSnapshot()).filter(
    ({ kind }) => kind === 'action',
  );
  const labels = actions.map(({ label }) => label);

  for (const label of [
    'Switch to 3D view',
    'Open export',
    'Open overlays',
    'Hide inspector',
    'Reset design style',
    'New landscape',
    'Copy style link',
    'Load Errigal',
    'Go to Contours',
  ]) {
    assert.ok(labels.includes(label), `missing action "${label}"`);
  }

  assert.ok(!labels.includes('Go to Camera'), '2D hides the Camera section');
});

void test('an action runs its studio effect', () => {
  const { controller } = createTestController();
  const exportAction = buildCommandIndex(controller, controller.getSnapshot()).find(
    ({ id }) => id === 'action-export',
  );

  assert.ok(exportAction?.kind === 'action');
  exportAction.run();
  assert.equal(controller.getSnapshot().workspace.exporting, true);
});

void test('location commands show coordinates for the preview', () => {
  const [location] = buildLocationCommands([
    {
      name: 'Ben Nevis',
      detail: 'Scotland',
      latitude: 56.7969,
      longitude: -5.0035,
      provider: 'photon',
    },
  ]);

  assert.equal(location.kind, 'location');
  assert.equal(location.label, 'Ben Nevis');
  assert.equal(location.coordinates, '56.7969°N 5.0035°W');
});

// === HELPERS ===

const valueRowKinds: ReadonlySet<ControlRowKind> = new Set([
  'toggle',
  'range',
  'select',
  'segmented',
  'number',
  'colour',
  'tiles',
]);

/** Independent of the index: flattens the builders' rows the way the inspector shows them. */
function listBuilderValueRowIds(controller: StudioController, state: StudioState): string[] {
  return controlGroupBuilders
    .flatMap((build) => build(controller, state))
    .filter(
      (group) =>
        state.workspace.view === '3d' ||
        !threeDOnlySections.includes(getSectionForGroup(group.id).id),
    )
    .flatMap((group) =>
      group.rows.flatMap((row) => {
        if (row === false || row === undefined) {
          return [];
        }

        if (row.kind === 'pair') {
          return row.fields.filter(({ kind }) => kind === 'number').map(({ id }) => id);
        }

        return valueRowKinds.has(row.kind) ? [row.id] : [];
      }),
    );
}

function findParameter(controller: StudioController, id: string) {
  const command = buildParameterCommands(controller, controller.getSnapshot()).find(
    (candidate) => candidate.id === id,
  );

  assert.ok(command, `no parameter "${id}"`);

  return command;
}

function withView(
  state: StudioState,
  view: StudioView,
  selected: StudioState['source']['selected'] = 'generated',
): StudioState {
  return {
    ...state,
    workspace: { ...state.workspace, view },
    source: { ...state.source, selected },
  };
}

void test('route commands appear only on real terrain, and clear and export wait for a route', () => {
  const { controller } = createTestController();
  const procedural = controller.getSnapshot();
  const real = {
    ...procedural,
    source: { ...procedural.source, terrain: { attribution: 'Test' } as RealTerrain },
  };
  const routeIds = (state: StudioState) =>
    buildCommandIndex(controller, state)
      .map(({ id }) => id)
      .filter((id) => id.startsWith('action-route-'));

  assert.deepEqual(routeIds(procedural), []);
  assert.deepEqual(routeIds(real), ['action-route-tool', 'action-route-draw']);

  const withRoute = {
    ...real,
    workspace: {
      ...real.workspace,
      route: {
        active: {
          id: 'drawn-1',
          name: 'Drawn route',
          provenance: 'drawn' as const,
          waypoints: [
            { latitude: 1, longitude: 1 },
            { latitude: 1, longitude: 2 },
          ],
          namedWaypoints: [],
          slopeThresholdPercent: 15,
        },
        editing: { mode: 'drawing' as const },
        isVisible: true,
      },
    },
  };

  assert.deepEqual(routeIds(withRoute), [
    'action-route-tool',
    'action-route-draw',
    'action-route-finish',
    'action-route-reverse',
    'action-route-clear',
    'action-route-export',
  ]);
});

function createTestController(): { controller: StudioController; updates: DesignSettings[] } {
  const parsed = parseDesignParameters(new URLSearchParams('v=1&seed=123'));

  assert.ok(parsed.ok);
  const design = parsed.data.settings;
  const updates: DesignSettings[] = [];
  const controller = createStudioController({
    getSettings: () => design,
    updateSettings: (settings) => {
      updates.push(settings);

      return true;
    },
    newLandscape: () => undefined,
    isSeedLocked: false,
    lockSeed: () => undefined,
    getShareUrl: () => 'https://landcu.be.test/',
    copyLink: () => Promise.resolve({ ok: true, data: undefined }),
  });

  return { controller, updates };
}
