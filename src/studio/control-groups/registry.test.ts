/*
 * Runs every section builder across the state matrix the migrations must cover:
 * view 2D/3D × terrain source generated/real × frame on (tray)/off (none).
 * Migrations (#90–#93) extend this as builders grow conditional groups, e.g. by adding a
 * loaded-real-terrain state or a circle crop, rather than writing per-section registry tests.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDesignParameters } from '../../design-settings';
import type { FrameStudioPreset } from '../../frame/frame-studio-settings';
import { createStudioController, type StudioController, type StudioState } from '../controller';
import { getGroupCode, isRegisteredGroupId } from '../sections';
import { controlGroupBuilders } from './index';

interface MatrixCase {
  name: string;
  state: StudioState;
}

void test('every group a builder emits is registered, once, with a unique code', () => {
  const controller = createTestController();

  for (const { name, state } of createStateMatrix(controller.getSnapshot())) {
    const groupIds = controlGroupBuilders.flatMap((build) =>
      build(controller, state).map((group) => group.id),
    );

    for (const groupId of groupIds) {
      assert.ok(isRegisteredGroupId(groupId), `${name}: group "${groupId}" is not registered`);
    }

    assert.equal(new Set(groupIds).size, groupIds.length, `${name}: a group id is emitted twice`);

    const codes = groupIds.map(getGroupCode);

    assert.equal(new Set(codes).size, codes.length, `${name}: two groups share a code`);
  }
});

void test('the state matrix covers 2D/3D × generated/real × frame on/off', () => {
  const controller = createTestController();

  assert.equal(createStateMatrix(controller.getSnapshot()).length, 8);
});

// === HELPERS ===

function createStateMatrix(initial: StudioState): MatrixCase[] {
  const views = ['2d', '3d'] as const;
  const sources = ['generated', 'real'] as const;
  const framePresets: FrameStudioPreset[] = ['none', 'tray'];

  return views.flatMap((view) =>
    sources.flatMap((selected) =>
      framePresets.map((preset) => ({
        name: `${view} ${selected} frame:${preset}`,
        state: {
          ...initial,
          workspace: { ...initial.workspace, view },
          source: { ...initial.source, selected },
          frame: { ...initial.frame, settings: { ...initial.frame.settings, preset } },
        },
      })),
    ),
  );
}

/** A controller over default design settings with no effects; builders only close over it. */
function createTestController(): StudioController {
  const parsed = parseDesignParameters(new URLSearchParams('v=1&seed=123'));

  assert.ok(parsed.ok);
  const design = parsed.data.settings;

  return createStudioController({
    getSettings: () => design,
    updateSettings: () => true,
    newLandscape: () => undefined,
    isSeedLocked: false,
    lockSeed: () => undefined,
    getShareUrl: () => 'https://landcu.be.test/',
    copyLink: () => Promise.resolve({ ok: true, data: undefined }),
  });
}
