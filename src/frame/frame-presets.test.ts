import assert from 'node:assert/strict';
import { test } from 'node:test';
import { frameProfilePresets } from '../constants/frame';
import type { TerrainModelSettings } from '../terrain-model';
import type { FrameProfilePoint, FrameProfilePreset } from '../types/frame';
import { composeFrameProfiles } from './frame-composition';
import { getFrameFootprint } from './frame-outline';
import { createDefaultFrame, createTrayPresetFrame } from './frame-presets';

const overallHeightMm = 40;

/** #34's `createTrayProfile`, kept verbatim as the reference the presets must reproduce. */
function createReferenceTrayProfile(
  preset: FrameProfilePreset,
  inner: number,
  outer: number,
  floorHeightMm: number,
  top: number,
): FrameProfilePoint[] {
  const point = (offsetMm: number, heightMm: number) => ({ offsetMm, heightMm });
  const featureMm = Math.min(outer - inner, top - floorHeightMm) / 2;
  const rimToFloor = [point(inner, top), point(inner, floorHeightMm)];
  const cove = Array.from({ length: 7 }, (_, index) => {
    const angle = ((index + 1) / 8) * (Math.PI / 2);

    return point(outer - Math.sin(angle) * featureMm, top - Math.cos(angle) * featureMm);
  });

  switch (preset) {
    case 'square':
      return [point(outer, 0), point(outer, top), ...rimToFloor];
    case 'chamfer':
      return [
        point(outer, 0),
        point(outer, top - featureMm),
        point(outer - featureMm, top),
        ...rimToFloor,
      ];
    case 'cove':
      return [
        point(outer, 0),
        point(outer, top - featureMm),
        ...cove,
        point(outer - featureMm, top),
        ...rimToFloor,
      ];
    case 'stepped':
      return [
        point(outer, 0),
        point(outer, top - featureMm),
        point(outer - featureMm / 2, top - featureMm),
        point(outer - featureMm / 2, top - featureMm / 2),
        point(outer - featureMm, top - featureMm / 2),
        point(outer - featureMm, top),
        ...rimToFloor,
      ];
    case 'floating':
      return [
        point(outer - featureMm, 0),
        point(outer, featureMm),
        point(outer, top),
        ...rimToFloor,
      ];
  }
}

for (const model of [
  { widthMm: 150, lengthMm: 150, baseThicknessMm: 3 },
  { widthMm: 120, lengthMm: 80, baseThicknessMm: 8, cropShape: 'circle' },
] satisfies TerrainModelSettings[]) {
  for (const preset of frameProfilePresets) {
    void test(`${preset} preset on a ${model.baseThicknessMm} mm base matches the #34 tray profile`, () => {
      const result = composeFrameProfiles(
        getFrameFootprint(model),
        model,
        overallHeightMm,
        createTrayPresetFrame(preset, model),
      );

      if (!result.ok) {
        assert.fail(result.error.message);
      }

      const expected = createReferenceTrayProfile(
        preset,
        0.3,
        10.3,
        2,
        2 + model.baseThicknessMm + 4,
      );
      const actual = result.data[0].profile.points;

      assert.equal(result.data.length, 1);
      assert.equal(actual.length, expected.length, JSON.stringify(actual));

      for (const [index, point] of actual.entries()) {
        assert.ok(
          Math.abs(point.offsetMm - expected[index].offsetMm) < 1e-6,
          `${preset} offset ${index}`,
        );
        assert.ok(
          Math.abs(point.heightMm - expected[index].heightMm) < 1e-6,
          `${preset} height ${index}`,
        );
      }
    });
  }
}

void test('default frame is the square tray with the rim 4 mm above the base', () => {
  const model = { widthMm: 150, lengthMm: 150, baseThicknessMm: 5 };

  assert.deepEqual(createDefaultFrame(model), createTrayPresetFrame('square', model));
  assert.deepEqual(createDefaultFrame(model).surround?.rimHeight, {
    reference: 'model-base',
    aboveMm: 4,
  });
  assert.equal(createDefaultFrame(model).clearanceMm, 0.3);
});
