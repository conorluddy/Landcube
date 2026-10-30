import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDesignParameters } from '../design-settings';
import type { CameraShot, CameraShotBlocker } from '../terrain-camera-shots';
import { createStudioController, type StudioEffects } from './controller';

const view: CameraShot = {
  target: { x: 0, y: 0, z: 0 },
  direction: { x: 0, y: 1, z: 0 },
  distance: 2,
};

void test('saving shots numbers them and announces each one', () => {
  const { controller } = setup();

  controller.saveCameraShot();
  controller.saveCameraShot();

  assert.deepEqual(
    controller.getSnapshot().cameraShots.shots.map((shot) => shot.id),
    [1, 2],
  );
  assert.equal(controller.getSnapshot().status, 'Shot 2 saved');
});

void test('saving outside the 3D view explains why nothing was saved', () => {
  const { controller } = setup({ blocker: 'not-3d' });

  controller.saveCameraShot();

  assert.equal(controller.getSnapshot().cameraShots.shots.length, 0);
  assert.equal(controller.getSnapshot().status, 'Switch to the 3D view to use shots');
});

void test('shot actions while walking ask the user to stop walking', () => {
  const { controller, effects } = setup();

  controller.saveCameraShot();
  effects.flyToCameraShot = () => 'walking';
  effects.playCameraShots = () => 'walking';
  controller.flyToCameraShot(1);

  assert.equal(controller.getSnapshot().status, 'Stop walking to use shots');

  controller.toggleCameraShotPlayback();

  assert.equal(controller.getSnapshot().cameraShots.isPlaying, false);
  assert.equal(controller.getSnapshot().status, 'Stop walking to use shots');
});

void test('playing without shots asks for one first', () => {
  const { controller, played } = setup();

  controller.toggleCameraShotPlayback();

  assert.equal(played.length, 0);
  assert.equal(controller.getSnapshot().cameraShots.isPlaying, false);
  assert.equal(controller.getSnapshot().status, 'Press B to save a shot first');
});

void test('play stays off when the 3D view cannot start the tour', () => {
  const { controller, effects } = setup();

  controller.saveCameraShot();
  effects.playCameraShots = () => 'not-3d';
  controller.toggleCameraShotPlayback();

  assert.equal(controller.getSnapshot().cameraShots.isPlaying, false);
});

void test('removing a shot mid-tour restarts the tour without it', () => {
  const { controller, played } = setup();

  controller.saveCameraShot();
  controller.saveCameraShot();
  controller.toggleCameraShotPlayback();
  controller.removeCameraShot(1);

  assert.equal(played.length, 2);
  assert.equal(played[1].length, 1);
  assert.equal(controller.getSnapshot().cameraShots.isPlaying, true);
});

void test('saving a shot mid-tour adds it to the running tour', () => {
  const { controller, played } = setup();

  controller.saveCameraShot();
  controller.toggleCameraShotPlayback();
  controller.saveCameraShot();

  assert.equal(played.at(-1)?.length, 2);
});

void test('removing the last shot stops the tour', () => {
  const { controller, stops } = setup();

  controller.saveCameraShot();
  controller.toggleCameraShotPlayback();
  controller.removeCameraShot(1);

  assert.equal(stops.count, 1);
  assert.equal(controller.getSnapshot().cameraShots.isPlaying, false);
});

void test('a drag that stops the tour turns Play back on', () => {
  const { controller, stopTour } = setup();

  controller.saveCameraShot();
  controller.toggleCameraShotPlayback();
  stopTour();

  assert.equal(controller.getSnapshot().cameraShots.isPlaying, false);
});

void test('a new landscape discards the shots', () => {
  const { controller } = setup();

  controller.saveCameraShot();
  controller.newLandscape();

  assert.equal(controller.getSnapshot().cameraShots.shots.length, 0);
});

function setup({ blocker }: { blocker?: CameraShotBlocker } = {}) {
  const parsed = parseDesignParameters(new URLSearchParams('v=1&seed=123'));

  assert.ok(parsed.ok);
  const design = parsed.data.settings;
  const played: (readonly CameraShot[])[] = [];
  const stops = { count: 0 };
  let onTourStop = (): void => undefined;
  const effects: StudioEffects = {
    applyTerrain: () => undefined,
    activate: () => Promise.resolve(),
    sceneChanged: () => undefined,
    modelChanged: () => undefined,
    resetCamera: () => undefined,
    setCameraDirection: () => undefined,
    applyViewPreset: () => undefined,
    pickFocus: () => Promise.resolve(false),
    walkAt: () => false,
    captureCameraShot: () => blocker ?? { shot: view, thumbnailUrl: '' },
    flyToCameraShot: () => blocker,
    playCameraShots: (shots, onStop) => {
      // Like the renderer, a new tour ends the running one first.
      onTourStop();

      if (blocker) {
        return blocker;
      }

      played.push(shots);
      onTourStop = onStop;

      return undefined;
    },
    stopCameraShots: () => {
      stops.count++;
      onTourStop();
    },
    downloadStill: () => Promise.resolve({ width: 1, height: 1 }),
    downloadStl: () => undefined,
    roadsChanged: () => undefined,
    frameChanged: () => undefined,
    downloadFrameStl: () => undefined,
  };
  const controller = createStudioController({
    getSettings: () => design,
    updateSettings: () => true,
    newLandscape: () => undefined,
    isSeedLocked: false,
    lockSeed: () => undefined,
    getShareUrl: () => 'https://landcu.be.test/',
    copyLink: () => Promise.resolve({ ok: true, data: undefined }),
  });

  controller.connect(effects);

  return {
    controller,
    effects,
    played,
    stops,
    stopTour: () => {
      onTourStop();
    },
  };
}
