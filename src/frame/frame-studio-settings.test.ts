import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validatePrintableSolid } from '../export/stl-export';
import type { TerrainModelSettings } from '../terrain-model';
import type { FrameAssembly } from '../types/frame';
import { createFrameAssembly } from './frame-assembly';
import {
  createStudioFrame,
  defaultFrameStudioSettings,
  explainFrameStudioError,
  frameStudioPresets,
  type FrameStudioSettings,
} from './frame-studio-settings';

const model: TerrainModelSettings = { widthMm: 150, lengthMm: 150, baseThicknessMm: 3 };
const overallHeightMm = 24;
const edgeShapes = ['square', 'chamfer', 'cove', 'round', 'ogee', 'step'] as const;

function build(overrides: Partial<FrameStudioSettings>): FrameAssembly {
  const result = createFrameAssembly(
    model,
    overallHeightMm,
    createStudioFrame({ ...defaultFrameStudioSettings, ...overrides }),
  );

  if (!result.ok) {
    assert.fail(result.error.message);
  }

  return result.data;
}

for (const { value: preset } of frameStudioPresets.filter(({ value }) => value !== 'none')) {
  for (const edgeShape of edgeShapes) {
    for (const hasFloatingToe of [false, true]) {
      void test(`${preset} with a ${edgeShape} edge${hasFloatingToe ? ' and toe' : ''} is printable`, () => {
        const assembly = build({ preset, edgeShape, hasFloatingToe });

        assert.ok(assembly.parts.length > 0);

        for (const part of assembly.parts) {
          validatePrintableSolid(part.solid);
        }
      });
    }
  }
}

void test('no frame builds no parts and seats the model on the bed', () => {
  const assembly = build({ preset: 'none' });

  assert.deepEqual(assembly.parts, []);
  assert.equal(assembly.seatHeightMm, 0);
});

void test('a default tray is the model plus border and clearance per side', () => {
  const [frame] = build({ preset: 'tray' }).parts;

  assert.ok(Math.abs(frame.sizeMm.x - 170.6) < 1e-4, `${frame.sizeMm.x}`);
  assert.ok(Math.abs(frame.sizeMm.z - 170.6) < 1e-4, `${frame.sizeMm.z}`);
  assert.equal(frame.sizeMm.y, 2 + 3 + 4);
});

void test('a pedestal holds the model in a 1.5 mm recess on its top face', () => {
  const assembly = build({ preset: 'pedestal' });

  assert.equal(assembly.seatHeightMm, 8);
  assert.equal(assembly.parts[0].sizeMm.y, 8 + 1.5);
});

void test('a tray on a plinth is wider than the tray by half a border per side', () => {
  const plinth = build({ preset: 'tray-on-plinth' });
  const tray = build({ preset: 'tray' });

  assert.ok(Math.abs(plinth.outerSizeMm.x - tray.outerSizeMm.x - 10) < 1e-9);
  assert.equal(plinth.seatHeightMm, 8);
});

void test('the tab explains the frame constraints its controls can break', () => {
  const pedestal = { ...defaultFrameStudioSettings, preset: 'pedestal' as const };

  assert.match(
    explainFrameStudioError({ ...pedestal, edgeShape: 'chamfer', edgeSizeMm: 9.5 }) ?? '',
    /Increase Stand height or reduce Edge size/,
  );
  assert.match(
    explainFrameStudioError({
      ...pedestal,
      borderWidthMm: 5,
      edgeShape: 'chamfer',
      edgeSizeMm: 4.5,
    }) ?? '',
    /Increase Overhang or reduce Edge size/,
  );
  assert.match(
    explainFrameStudioError({
      ...pedestal,
      standHeightMm: 3,
      edgeShape: 'cove',
      edgeSizeMm: 2.5,
      hasFloatingToe: true,
    }) ?? '',
    /turn off Floating toe/,
  );
  assert.match(
    explainFrameStudioError({
      ...defaultFrameStudioSettings,
      preset: 'stacked-pedestal',
      standHeightMm: 1.2,
    }) ?? '',
    /Increase Stand height to at least 2.4 mm/,
  );
  assert.equal(explainFrameStudioError(pedestal), undefined);
  assert.equal(
    explainFrameStudioError({
      ...defaultFrameStudioSettings,
      preset: 'tray',
      hasFloatingToe: true,
    }),
    undefined,
  );
});

for (const rimAboveBaseMm of [-2, 50]) {
  void test(`a tray rim ${rimAboveBaseMm} mm above the model base is printable`, () => {
    assert.ok(build({ preset: 'tray', rimAboveBaseMm }).parts.length > 0);
  });
}
