import assert from 'node:assert/strict';
import { test } from 'node:test';
import { frameProfilePresets } from '../constants/frame';
import type { FrameProfile } from '../types/frame';
import {
  createTrayProfile,
  measureNarrowestWallMm,
  validateProfileOverhang,
} from './frame-profiles';

const dimensions = { innerOffsetMm: 0.3, outerOffsetMm: 10.3, floorHeightMm: 2, topHeightMm: 9 };

function expectRejection(profile: FrameProfile): string {
  const result = validateProfileOverhang(profile);

  if (result.ok) {
    assert.fail('Expected the profile to be rejected.');
  }

  return result.error.message;
}

for (const preset of frameProfilePresets) {
  void test(`${preset} preset prints without supports in its declared orientation`, () => {
    const result = validateProfileOverhang(createTrayProfile(preset, dimensions));

    assert.ok(result.ok, result.ok ? '' : result.error.message);
  });
}

void test('a 60° upright overhang is rejected and its segment named', () => {
  const run = Math.tan((60 * Math.PI) / 180);
  const message = expectRejection({
    printOrientation: 'upright',
    points: [
      { offsetMm: 10, heightMm: 0 },
      { offsetMm: 10, heightMm: 5 },
      { offsetMm: 10 + run, heightMm: 6 },
      { offsetMm: 0, heightMm: 6 },
    ],
  });

  assert.match(message, /^Profile segment 1 /);
  assert.match(message, /60\.0°/);
  assert.match(message, /to \(11\.73, 6\)/);
});

void test('an overhang of exactly 45° is accepted', () => {
  const result = validateProfileOverhang({
    printOrientation: 'upright',
    points: [
      { offsetMm: 8, heightMm: 0 },
      { offsetMm: 10, heightMm: 2 },
      { offsetMm: 10, heightMm: 6 },
      { offsetMm: 0, heightMm: 6 },
    ],
  });

  assert.ok(result.ok);
});

void test('face-down printing turns an upright floor cap into an overhang', () => {
  const tray = createTrayProfile('square', dimensions);
  const message = expectRejection({ ...tray, printOrientation: 'face-down' });

  assert.match(message, /cap/);
});

void test('a raised start cap is an unsupported ceiling when upright', () => {
  const message = expectRejection({
    printOrientation: 'upright',
    points: [
      { offsetMm: 10, heightMm: 2 },
      { offsetMm: 10, heightMm: 6 },
      { offsetMm: 0, heightMm: 6 },
      { offsetMm: 0, heightMm: 0 },
    ],
  });

  assert.match(message, /^The start cap at height 2 mm overhangs 90\.0°/);
});

void test('narrowest wall is the rim land for a chamfer and the full border for square', () => {
  const featureMm = 3.5;

  for (const [preset, expectedMm] of [
    ['square', 10],
    ['chamfer', 10 - featureMm],
    ['cove', 10 - featureMm],
    ['stepped', 10 - featureMm],
    ['floating', 10 - (featureMm - dimensions.floorHeightMm)],
  ] as const) {
    const { points } = createTrayProfile(preset, dimensions);
    const wallMm = measureNarrowestWallMm(
      points,
      dimensions.innerOffsetMm,
      dimensions.floorHeightMm,
    );

    assert.ok(Math.abs(wallMm - expectedMm) < 1e-9, `${preset}: ${wallMm}`);
  }
});
