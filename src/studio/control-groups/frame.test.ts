import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { parseDesignParameters } from '../../design-settings';
import type { FrameStudioPreset } from '../../frame/frame-studio-settings';
import { ControlGroup } from '../../ui/control-group';
import type { ControlGroupDefinition } from '../../ui/control-rows';
import { renderMarkup } from '../../ui/test-helpers';
import { createStudioController, type StudioController, type StudioState } from '../controller';
import { buildFrameGroups } from './frame';

void test('with no frame only the style group shows, with its hint', () => {
  const { controller, state } = createContext();
  const groups = buildFrameGroups(controller, state);

  assert.deepEqual(listGroupIds(groups), ['frame']);
  assert.deepEqual(listRowIds(groups, 'frame'), ['frame-style', 'frame-none-hint']);
});

void test('a tray adds finish, dimensions with a rim, and the edge group', () => {
  const { controller, state } = createContext();
  const groups = buildFrameGroups(controller, withPreset(state, 'tray'));

  assert.deepEqual(listGroupIds(groups), ['frame', 'dimensions', 'edge']);
  assert.deepEqual(listRowIds(groups, 'frame'), ['frame-style', 'frame-finish']);
  assert.deepEqual(listRowIds(groups, 'dimensions'), [
    'frame-border',
    'frame-clearance',
    'frame-rim-above-base',
  ]);
  assert.deepEqual(listRowIds(groups, 'edge'), [
    'frame-edge-shape',
    'frame-floating-toe',
    'frame-download-hint',
  ]);
});

void test('a pedestal adds the recess hint and the stand height instead of the rim', () => {
  const { controller, state } = createContext();
  const groups = buildFrameGroups(controller, withPreset(state, 'pedestal'));

  assert.ok(listRowIds(groups, 'frame').includes('frame-recess-hint'));
  assert.deepEqual(listRowIds(groups, 'dimensions'), [
    'frame-border',
    'frame-clearance',
    'frame-stand-height',
  ]);
});

void test('style and edge tiles render in five and six columns, pressed state intact', () => {
  const { controller, state } = createContext();
  const markup = renderGroups(buildFrameGroups(controller, withPreset(state, 'tray')));

  assert.match(markup, /aria-label="Frame style"[^>]*data-columns="5"/);
  assert.match(markup, /aria-label="Edge shape"[^>]*data-columns="6"/);
  assert.match(markup, /aria-label="Frame finish"[^>]*data-columns="3"/);
  assert.match(markup, /aria-pressed="true"[^>]*title="Tray"/);
});

void test('an edge shape other than square adds the edge size', () => {
  const { controller, state } = createContext();
  const rounded: StudioState = {
    ...state,
    frame: { settings: { ...state.frame.settings, preset: 'tray', edgeShape: 'round' } },
  };

  assert.ok(listRowIds(buildFrameGroups(controller, rounded), 'edge').includes('frame-edge-size'));
});

// === HELPERS ===

function withPreset(state: StudioState, preset: FrameStudioPreset): StudioState {
  return { ...state, frame: { ...state.frame, settings: { ...state.frame.settings, preset } } };
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
