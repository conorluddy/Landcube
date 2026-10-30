import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { parseDesignParameters } from '../../design-settings';
import { ControlGroup } from '../../ui/control-group';
import type { ControlGroupDefinition } from '../../ui/control-rows';
import { renderMarkup } from '../../ui/test-helpers';
import { createStudioController, type StudioController, type StudioState } from '../controller';
import type { CropPreview } from '../crop-preview';
import { buildModelGroups } from './model';

const cropPreview: CropPreview = { attach: () => () => undefined, update: () => undefined };

void test('a rectangular model shows the crop preview, a width-length pair and shape controls', () => {
  const { controller, state } = createContext();
  const groups = buildModelGroups(controller, state, cropPreview);

  assert.deepEqual(listGroupIds(groups), ['model-dimensions', 'shape']);
  assert.deepEqual(listRowIds(groups, 'model-dimensions'), [
    'crop-preview',
    'model-footprint',
    'model-base-thickness',
    'model-height-hint',
  ]);
  assert.deepEqual(listRowIds(groups, 'shape'), ['model-terrain-shape', 'model-download-hint']);

  const markup = renderGroups(groups);

  assert.match(markup, /Width \(X, mm\)/);
  assert.match(markup, /Length \(Y, mm\)/);
  assert.match(markup, /<output>[^<]*mm<\/output>/);
});

void test('a circular model shows one diameter field', () => {
  const { controller, state } = createContext();
  const groups = buildModelGroups(
    controller,
    withDimensions(state, { cropShape: 'circle' }),
    cropPreview,
  );
  const markup = renderGroups(groups);

  assert.deepEqual(listRowIds(groups, 'model-dimensions').slice(1, 3), [
    'model-width',
    'model-base-thickness',
  ]);
  assert.match(markup, /Diameter \(mm\)/);
  assert.doesNotMatch(markup, /Length \(Y, mm\)/);
});

void test('terraced terrain adds its layer height hint, and no preview row without a widget', () => {
  const { controller, state } = createContext();
  const groups = buildModelGroups(controller, withDimensions(state, { terrainShape: 'terraced' }));

  assert.ok(listRowIds(groups, 'shape').includes('model-terraced-hint'));
  assert.ok(!listRowIds(groups, 'model-dimensions').includes('crop-preview'));
});

// === HELPERS ===

function withDimensions(
  state: StudioState,
  patch: Partial<StudioState['model']['dimensions']>,
): StudioState {
  return {
    ...state,
    model: { ...state.model, dimensions: { ...state.model.dimensions, ...patch } },
  };
}

function createContext(): { controller: StudioController; state: StudioState } {
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

  return { controller, state: controller.getSnapshot() };
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
