import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { parseDesignParameters } from '../../design-settings';
import { ControlGroup } from '../../ui/control-group';
import type { ControlGroupDefinition } from '../../ui/control-rows';
import { renderMarkup } from '../../ui/test-helpers';
import { createStudioController, type StudioController, type StudioState } from '../controller';
import { buildCameraGroups, buildOrbitGroups } from './camera';

void test('perspective camera shows lens, focus, exposure and orbit with the original ids', () => {
  const { controller, state } = createContext();
  const groups = [...buildCameraGroups(controller, state), ...buildOrbitGroups(controller, state)];

  assert.deepEqual(listGroupIds(groups), ['lens', 'focus', 'exposure', 'orbit', 'director']);
  assert.deepEqual(listRowIds(groups, 'lens'), [
    'camera-projection',
    'camera-focal-length',
    'camera-lens-hint',
  ]);
  assert.deepEqual(listRowIds(groups, 'focus'), ['camera-focus-effect']);
  assert.deepEqual(listRowIds(groups, 'exposure'), ['camera-exposure', 'camera-reset-settings']);
  assert.deepEqual(listRowIds(groups, 'orbit'), [
    'orbit-view-presets',
    'orbit-auto-rotate',
    'orbit-rotation-seconds',
    'orbit-turn-direction',
    'orbit-reset-camera',
    'orbit-controls-hint',
  ]);

  const markup = renderGroups(groups);

  for (const id of ['camera-focal-length', 'camera-exposure', 'orbit-rotation-seconds']) {
    assert.match(markup, new RegExp(`id="${id}"`), `${id} is rendered`);
  }
});

void test('orthographic projection swaps the focal length for the axonometric hint', () => {
  const { controller, state } = createContext();
  const groups = buildCameraGroups(controller, withCamera(state, { projection: 'orthographic' }));

  assert.deepEqual(listRowIds(groups, 'lens'), ['camera-projection', 'camera-axonometric-hint']);
});

void test('tilt-shift adds its three bands and depth of field adds aperture and pick focus', () => {
  const { controller, state } = createContext();
  const tiltShift = buildCameraGroups(controller, withCamera(state, { focusEffect: 'tilt-shift' }));
  const depthOfField = buildCameraGroups(
    controller,
    withCamera(state, { focusEffect: 'depth-of-field' }),
  );
  const orthographicDepthOfField = buildCameraGroups(
    controller,
    withCamera(state, { focusEffect: 'depth-of-field', projection: 'orthographic' }),
  );

  assert.deepEqual(listRowIds(tiltShift, 'focus').slice(1, 4), [
    'camera-tiltShiftPosition',
    'camera-tiltShiftWidth',
    'camera-tiltShiftBlur',
  ]);
  assert.deepEqual(listRowIds(depthOfField, 'focus').slice(1, 4), [
    'camera-aperture',
    'camera-focus-follows-target',
    'camera-pick-focus',
  ]);
  assert.deepEqual(listRowIds(orthographicDepthOfField, 'focus'), [
    'camera-focus-effect',
    'camera-depth-of-field-orthographic-hint',
  ]);
});

void test('orbit has its own section and the camera reset stays with the camera settings', () => {
  const { controller, state } = createContext();
  const cameraGroups = buildCameraGroups(controller, state);

  assert.deepEqual(listGroupIds(cameraGroups), ['lens', 'focus', 'exposure']);
  assert.ok(listRowIds(cameraGroups, 'exposure').includes('camera-reset-settings'));
  assert.deepEqual(listGroupIds(buildOrbitGroups(controller, state)), ['orbit', 'director']);
});

// === HELPERS ===

function withCamera(
  state: StudioState,
  patch: Partial<StudioState['scene']['camera']>,
): StudioState {
  return { ...state, scene: { ...state.scene, camera: { ...state.scene.camera, ...patch } } };
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

void test('director shows a hint until a shot is saved, then the strip and playback', () => {
  const { controller, state } = createContext();
  const empty = buildOrbitGroups(controller, state);

  assert.deepEqual(listRowIds(empty, 'director'), [
    'director-empty',
    'director-add-shot',
    'director-play',
    'director-clear',
  ]);

  const withShot = buildOrbitGroups(controller, {
    ...state,
    cameraShots: {
      shots: [
        {
          id: 1,
          thumbnailUrl: '',
          target: { x: 0, y: 0, z: 0 },
          direction: { x: 0, y: 1, z: 0 },
          distance: 2,
        },
      ],
      isPlaying: false,
    },
  });

  assert.equal(listRowIds(withShot, 'director')[0], 'director-shots');
});
