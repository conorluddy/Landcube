import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDesignParameters } from '../../design-settings';
import type { ControlGroupDefinition } from '../../ui/control-rows';
import { createStudioController, type StudioState } from '../controller';
import { buildDirectorGroups } from './director';

const savedShot = {
  id: 1,
  thumbnailUrl: '',
  target: { x: 0, y: 0, z: 0 },
  direction: { x: 0, y: 1, z: 0 },
  distance: 2,
};

void test('director shows a hint until a shot is saved', () => {
  const { controller, state } = createContext();

  assert.deepEqual(listRowIds(buildDirectorGroups(controller, state)), [
    'director-empty',
    'director-add-shot',
    'director-play',
    'director-clear',
  ]);
});

void test('saved shots replace the hint with the shot strip', () => {
  const { controller, state } = createContext();
  const groups = buildDirectorGroups(controller, {
    ...state,
    cameraShots: { shots: [savedShot], isPlaying: false },
  });

  assert.equal(listRowIds(groups)[0], 'director-shot-strip');
});

function createContext(): {
  controller: ReturnType<typeof createStudioController>;
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

  return { controller, state: controller.getSnapshot() };
}

function listRowIds(groups: readonly ControlGroupDefinition[]): string[] {
  return groups[0].rows.flatMap((row) => (row === false || row === undefined ? [] : [row.id]));
}
