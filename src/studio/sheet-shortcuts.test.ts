import assert from 'node:assert/strict';
import test from 'node:test';
import { versionOneDesignDefaults } from '../constants/design';
import { validateDesignSettings } from '../design-settings';
import { createStudioController, type StudioState } from './controller';
import { isRegisteredGroupId, getSectionForGroup } from './sections';
import { describeSheetShortcuts } from './sheet-shortcuts';

function setupState(): StudioState {
  const settings = validateDesignSettings(versionOneDesignDefaults);

  assert.ok(settings.ok);

  return createStudioController({
    getSettings: () => settings.data,
    updateSettings: () => true,
    newLandscape: () => undefined,
    isSeedLocked: false,
    lockSeed: () => undefined,
    getShareUrl: () => '',
    copyLink: () => Promise.resolve({ ok: true, data: undefined }),
  }).getSnapshot();
}

void test('2D procedural terrain offers Terrain, Contours, Colour and Export, with Terrain on the procedural group', () => {
  const state = setupState();
  const shortcuts = describeSheetShortcuts({
    ...state,
    workspace: { ...state.workspace, view: '2d' },
  });

  assert.deepEqual(
    shortcuts.map((shortcut) => shortcut.id),
    ['terrain', 'contours', 'colour', 'export'],
  );
  const terrain = shortcuts[0];

  assert.ok(terrain.kind === 'group');
  assert.equal(terrain.groupId, 'procedural-landscape');
});

void test('real terrain sends the Terrain shortcut to the location group and keeps the order', () => {
  const state = setupState();
  const shortcuts = describeSheetShortcuts({
    workspace: { ...state.workspace, view: '2d' },
    source: { ...state.source, terrain: {} as NonNullable<typeof state.source.terrain> },
  });
  const terrain = shortcuts[0];

  assert.ok(terrain.kind === 'group');
  assert.equal(terrain.groupId, 'real-location');
  assert.deepEqual(
    shortcuts.map((shortcut) => shortcut.id),
    ['terrain', 'contours', 'colour', 'export'],
  );
});

void test('3D adds the Camera shortcut before Export', () => {
  const state = setupState();
  const shortcuts = describeSheetShortcuts({
    ...state,
    workspace: { ...state.workspace, view: '3d' },
  });

  assert.deepEqual(
    shortcuts.map((shortcut) => shortcut.id),
    ['terrain', 'contours', 'colour', 'camera', 'export'],
  );
});

void test('every group shortcut points at a registered group inside its own section', () => {
  const state = setupState();
  const shortcuts = describeSheetShortcuts({
    ...state,
    workspace: { ...state.workspace, view: '3d' },
  });

  for (const shortcut of shortcuts) {
    if (shortcut.kind !== 'group') {
      continue;
    }

    assert.ok(isRegisteredGroupId(shortcut.groupId), `${shortcut.groupId} is registered`);
    assert.equal(getSectionForGroup(shortcut.groupId).id, shortcut.sectionId);
  }
});
