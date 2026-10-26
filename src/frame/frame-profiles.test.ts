import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FrameEdge, FrameProfile } from '../types/frame';
import {
  createInnerEdgePoints,
  createOuterEdgePoints,
  measureNarrowestWallMm,
  validateProfileOverhang,
} from './frame-profiles';

const corner = { offsetMm: 10.3, heightMm: 9 };
const sizedEdges: readonly FrameEdge[] = (
  ['chamfer', 'cove', 'round', 'ogee', 'step'] as const
).map((shape) => ({ shape, sizeMm: 3 }));

/** A tray block with `edge` on both rim corners. */
function createRimProfile(edge: FrameEdge): FrameProfile {
  return {
    printOrientation: 'upright',
    points: [
      { offsetMm: 10.3, heightMm: 0 },
      ...createOuterEdgePoints(edge, corner),
      ...createInnerEdgePoints(edge, { offsetMm: 0.3, heightMm: 9 }),
      { offsetMm: 0.3, heightMm: 2 },
    ],
  };
}

function expectRejection(profile: FrameProfile): string {
  const result = validateProfileOverhang(profile);

  if (result.ok) {
    assert.fail('Expected the profile to be rejected.');
  }

  return result.error.message;
}

for (const edge of sizedEdges) {
  void test(`a ${edge.shape} edge runs from the outer face to the top face`, () => {
    const points = createOuterEdgePoints(edge, corner);

    const end = points[points.length - 1];

    assert.deepEqual(points[0], { offsetMm: 10.3, heightMm: 6 });
    assert.ok(Math.abs(end.offsetMm - 7.3) < 1e-9 && end.heightMm === 9, JSON.stringify(end));
  });

  void test(`a ${edge.shape} edge on both rim corners prints upright without supports`, () => {
    const result = validateProfileOverhang(createRimProfile(edge));

    assert.ok(result.ok, result.ok ? '' : result.error.message);
  });
}

void test('an inner edge mirrors the outer one and runs from the top face down', () => {
  const points = createInnerEdgePoints(
    { shape: 'chamfer', sizeMm: 2 },
    { offsetMm: 0.3, heightMm: 9 },
  );

  assert.deepEqual(points, [
    { offsetMm: 2.3, heightMm: 9 },
    { offsetMm: 0.3, heightMm: 7 },
  ]);
});

void test('a square edge is just the corner', () => {
  assert.deepEqual(createOuterEdgePoints({ shape: 'square' }, corner), [corner]);
});

void test('a round edge bulges out and a cove cuts in', () => {
  const [, roundPoint] = createOuterEdgePoints({ shape: 'round', sizeMm: 3 }, corner).slice(3);
  const [, covePoint] = createOuterEdgePoints({ shape: 'cove', sizeMm: 3 }, corner).slice(3);

  // Past the chamfer line (offset + height = 16.3) for round, short of it for cove.
  assert.ok(roundPoint.offsetMm + roundPoint.heightMm > 16.3);
  assert.ok(covePoint.offsetMm + covePoint.heightMm < 16.3);
});

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
  const tray = createRimProfile({ shape: 'square' });
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

void test('narrowest wall is the rim land for a sized edge and the full border for square', () => {
  for (const [edge, expectedMm] of [
    [{ shape: 'square' }, 10],
    [{ shape: 'chamfer', sizeMm: 3.5 }, 6.5],
    [{ shape: 'step', sizeMm: 3.5 }, 6.5],
  ] as const) {
    const points = [
      { offsetMm: 10.3, heightMm: 0 },
      ...createOuterEdgePoints(edge, corner),
      { offsetMm: 0.3, heightMm: 9 },
      { offsetMm: 0.3, heightMm: 2 },
    ];
    const wallMm = measureNarrowestWallMm(points, 0.3, 2);

    assert.ok(Math.abs(wallMm - expectedMm) < 1e-9, `${edge.shape}: ${wallMm}`);
  }
});

void test('a notch between horizontal faces counts as the narrowest wall', () => {
  const notchedProfile = [
    { offsetMm: 10, heightMm: 0 },
    { offsetMm: 10, heightMm: 4 },
    { offsetMm: 2, heightMm: 4 },
    { offsetMm: 2, heightMm: 6 },
    { offsetMm: 10, heightMm: 6 },
    { offsetMm: 10, heightMm: 9 },
    { offsetMm: 0.3, heightMm: 9 },
    { offsetMm: 0.3, heightMm: 2 },
  ];

  assert.ok(Math.abs(measureNarrowestWallMm(notchedProfile, 0.3, 2) - 1.7) < 1e-9);
});

void test('a lid passes face-down but needs supports upright', () => {
  const lid = [
    { offsetMm: 0.3, heightMm: 6 },
    { offsetMm: 0.3, heightMm: 0 },
    { offsetMm: 10, heightMm: 0 },
    { offsetMm: 10, heightMm: 8 },
  ];

  assert.ok(validateProfileOverhang({ points: lid, printOrientation: 'face-down' }).ok);
  assert.match(
    expectRejection({ points: lid, printOrientation: 'upright' }),
    /^The start cap at height 6 mm overhangs 90\.0°/,
  );
});
