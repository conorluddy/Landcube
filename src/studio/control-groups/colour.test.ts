import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { designPalettePresets } from '../../constants/palettes';
import { parseDesignParameters } from '../../design-settings';
import { ControlGroup } from '../../ui/control-group';
import type { ControlGroupDefinition, TilesRow } from '../../ui/control-rows';
import { renderMarkup } from '../../ui/test-helpers';
import { createStudioController, type StudioController, type StudioState } from '../controller';
import { buildColourGroups } from './colour';

void test('2D shows the palette and the style reset only', () => {
  const { controller, state } = createContext();
  const groups = buildColourGroups(controller, state);

  assert.deepEqual(listGroupIds(groups), ['palette', 'style-reset']);
  assert.deepEqual(listRowIds(groups, 'palette'), [
    'palette-presets',
    'palette-random',
    'background',
    'palette-hint',
  ]);
  assert.deepEqual(listRowIds(groups, 'style-reset'), ['style-reset-button', 'style-reset-hint']);
});

void test('3D adds materials, land, elevation gradient and water material in order', () => {
  const { controller, state } = createContext({ view: '3d' });

  assert.deepEqual(listGroupIds(buildColourGroups(controller, state)), [
    'palette',
    'materials',
    'land',
    'elevation-gradient',
    'water-material',
    'style-reset',
  ]);
});

void test('the gradient editor rows and the land surface rows follow the gradient toggle', () => {
  const off = createContext({ view: '3d' });
  const offGroups = buildColourGroups(off.controller, off.state);

  assert.deepEqual(listRowIds(offGroups, 'elevation-gradient'), ['gradient-enabled']);
  assert.deepEqual(listRowIds(offGroups, 'land'), [
    'land-finish',
    'land-surface-match',
    'land-surface-color',
    'land-hint',
  ]);

  const on = createContext({ view: '3d', isGradientEnabled: true });
  const onGroups = buildColourGroups(on.controller, on.state);

  assert.deepEqual(listRowIds(onGroups, 'elevation-gradient'), [
    'gradient-enabled',
    'gradient-preset',
    'gradient-transition',
    'gradient-editor',
    'gradient-hint',
  ]);
  assert.deepEqual(listRowIds(onGroups, 'land'), ['land-finish', 'land-hint']);

  const markup = renderGroups(onGroups);

  assert.match(markup, /Add color stop/);
  assert.match(markup, /Stop 1 color/);
});

void test('isPressedComputed marks only the preset whose settings all match', () => {
  const { controller, state } = createContext({ design: designPalettePresets.Paper });
  const row = findPaletteTiles(buildColourGroups(controller, state));
  const pressedNames = row.options
    .filter((option) => row.isPressedComputed?.(option) === true)
    .map((option) => option.value);

  assert.deepEqual(pressedNames, ['Paper']);
  assert.match(
    renderGroups(buildColourGroups(controller, state)),
    /aria-pressed="true"[^>]*title="Paper"/,
  );
});

void test('no tile is pressed once a preset setting is edited', () => {
  const { controller, state } = createContext({
    design: { ...designPalettePresets.Paper, lineColor: '#123456' },
  });
  const row = findPaletteTiles(buildColourGroups(controller, state));

  assert.ok(row.options.every((option) => row.isPressedComputed?.(option) === false));
});

void test('palette tiles carry the preset background and line colour as their swatch', () => {
  const { controller, state } = createContext();
  const row = findPaletteTiles(buildColourGroups(controller, state));
  const paper = row.options.find((option) => option.value === 'Paper');

  assert.ok(paper);
  assert.equal(paper.swatchColor, designPalettePresets.Paper.background);
  assert.equal(paper.swatchBorderColor, designPalettePresets.Paper.lineColor);
});

void test('the canvas colour input keeps the legacy background id', () => {
  const { controller, state } = createContext();

  assert.match(renderGroups(buildColourGroups(controller, state)), /id="background"/);
});

// === HELPERS ===

interface ContextOverrides {
  view?: '2d' | '3d';
  isGradientEnabled?: boolean;
  design?: Partial<StudioState['design']>;
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
      design: { ...initial.design, ...overrides.design },
      workspace: { ...initial.workspace, view: overrides.view ?? '2d' },
      scene: {
        ...initial.scene,
        gradient: { ...initial.scene.gradient, enabled: overrides.isGradientEnabled ?? false },
      },
    },
  };
}

function findPaletteTiles(groups: readonly ControlGroupDefinition[]): TilesRow {
  const group = groups.find((candidate) => candidate.id === 'palette');
  const row = group?.rows.find(
    (candidate): candidate is TilesRow => candidate !== false && candidate?.kind === 'tiles',
  );

  assert.ok(row, 'palette presets are a tiles row');

  return row;
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
