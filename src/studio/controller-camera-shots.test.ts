import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDesignParameters } from '../design-settings';
import type { CameraShot } from '../terrain-camera-shots';
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

void test('saving outside the 3D view does nothing', () => {
  const { controller } = setup({ isViewShowing: false });

  controller.saveCameraShot();

  assert.equal(controller.getSnapshot().cameraShots.shots.length, 0);
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
  effects.playCameraShots = () => false;
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

function setup({ isViewShowing = true }: { isViewShowing?: boolean } = {}) {
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
    captureCameraShot: () => (isViewShowing ? { shot: view, thumbnailUrl: '' } : undefined),
    flyToCameraShot: () => undefined,
    playCameraShots: (shots, onStop) => {
      // Like the renderer, a new tour ends the running one first.
      onTourStop();
      played.push(shots);
      onTourStop = onStop;

      return true;
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
