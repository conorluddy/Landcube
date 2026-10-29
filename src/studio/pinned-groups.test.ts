import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDesignParameters } from '../design-settings';
import { createStudioController, type StudioController } from './controller';

function createController(): StudioController {
  const parsed = parseDesignParameters(new URLSearchParams('v=1&seed=1'));

  if (!parsed.ok) {
    throw new Error(parsed.error.message);
  }

  return createStudioController({
    getSettings: () => parsed.data.settings,
    updateSettings: () => true,
    newLandscape: () => undefined,
    isSeedLocked: false,
    lockSeed: () => undefined,
    getShareUrl: () => 'https://topogra.test/',
    copyLink: () => Promise.resolve({ ok: true, data: undefined }),
  });
}

function pinnedGroups(controller: StudioController) {
  return controller.getSnapshot().workspace.pinnedGroups;
}

void test('nothing is pinned in a new session', () => {
  assert.deepEqual(pinnedGroups(createController()), []);
});

void test('pinning cascades new panels and stacks each on top', () => {
  const controller = createController();

  controller.pinGroup('contour-density');
  controller.pinGroup('lens');
  controller.pinGroup('lens');

  assert.deepEqual(pinnedGroups(controller), [
    { id: 'contour-density', position: { xPx: 24, yPx: 72 }, zIndex: 1 },
    { id: 'lens', position: { xPx: 48, yPx: 96 }, zIndex: 2 },
  ]);
});

void test('raising a lower panel puts it above the others; raising the top one changes nothing', () => {
  const controller = createController();

  controller.pinGroup('contour-density');
  controller.pinGroup('lens');

  const beforeRaise = controller.getSnapshot();

  controller.raiseGroup('lens');
  assert.equal(controller.getSnapshot(), beforeRaise);

  controller.raiseGroup('contour-density');
  assert.deepEqual(
    pinnedGroups(controller).map(({ id, zIndex }) => [id, zIndex]),
    [
      ['contour-density', 3],
      ['lens', 2],
    ],
  );
});

void test('moving and docking only touch the named group', () => {
  const controller = createController();

  controller.pinGroup('contour-density');
  controller.pinGroup('lens');
  controller.moveGroup('lens', { xPx: 120, yPx: 168 });
  controller.dockGroup('contour-density');
  controller.dockGroup('contour-density');

  assert.deepEqual(pinnedGroups(controller), [
    { id: 'lens', position: { xPx: 120, yPx: 168 }, zIndex: 2 },
  ]);
});

void test('moving to the current position publishes nothing', () => {
  const controller = createController();

  controller.pinGroup('lens');

  const beforeMove = controller.getSnapshot();

  controller.moveGroup('lens', { xPx: 24, yPx: 72 });
  assert.equal(controller.getSnapshot(), beforeMove);
});
