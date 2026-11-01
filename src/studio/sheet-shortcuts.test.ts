import assert from 'node:assert/strict';
import test from 'node:test';
import { versionOneDesignDefaults } from '../constants/design';
import { validateDesignSettings } from '../design-settings';
import { createStudioController, type StudioState } from './controller';
import { isRegisteredGroupId, getSectionForGroup } from './sections';
import { createRevealPoller, describeSheetShortcuts, type FrameScheduler } from './sheet-shortcuts';

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
    source: { ...state.source, terrain: { sample: () => 0, attribution: 'Test tiles' } },
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

/** Frames run only when the test pumps them, so each tick is observable. */
function setupFrames(): FrameScheduler & { pump: () => void; cancelled: number[] } {
  const queue = new Map<number, () => void>();
  const cancelled: number[] = [];
  let nextHandle = 1;

  return {
    cancelled,
    request: (callback) => {
      const handle = nextHandle++;

      queue.set(handle, callback);

      return handle;
    },
    cancel: (handle) => {
      queue.delete(handle);
      cancelled.push(handle);
    },
    pump: () => {
      const due = [...queue.values()];

      queue.clear();
      due.forEach((callback) => {
        callback();
      });
    },
  };
}

void test('the poller retries once a frame until the attempt succeeds, then stops', () => {
  const frames = setupFrames();
  const poller = createRevealPoller(frames, 5);
  let attempts = 0;
  let gaveUp = false;

  poller.schedule(
    () => {
      attempts += 1;

      return attempts === 3;
    },
    () => {
      gaveUp = true;
    },
  );
  frames.pump();
  frames.pump();
  frames.pump();
  frames.pump();

  assert.equal(attempts, 3);
  assert.equal(gaveUp, false);
});

void test('the poller gives up after its frame budget and reports it once', () => {
  const frames = setupFrames();
  const poller = createRevealPoller(frames, 3);
  let attempts = 0;
  let giveUps = 0;

  poller.schedule(
    () => {
      attempts += 1;

      return false;
    },
    () => {
      giveUps += 1;
    },
  );

  for (let frame = 0; frame < 6; frame++) {
    frames.pump();
  }

  assert.equal(attempts, 3);
  assert.equal(giveUps, 1);
});

void test('a newer reveal or a cancel drops the pending frame', () => {
  const frames = setupFrames();
  const poller = createRevealPoller(frames, 5);
  const runs: string[] = [];

  poller.schedule(
    () => {
      runs.push('first');

      return false;
    },
    () => undefined,
  );
  poller.schedule(
    () => {
      runs.push('second');

      return false;
    },
    () => undefined,
  );
  frames.pump();
  poller.cancel();
  frames.pump();

  assert.deepEqual(runs, ['second']);
  assert.deepEqual(frames.cancelled, [1, 3]);
});
