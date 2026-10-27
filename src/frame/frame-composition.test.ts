import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validatePrintableSolid } from '../export/stl-export';
import type { TerrainModelSettings } from '../terrain-model';
import type { FrameSettings, FrameSurround, FrameTier } from '../types/frame';
import type { Result } from '../types/operations';
import { createFrameAssembly } from './frame-assembly';
import { composeFrameProfiles } from './frame-composition';
import type { FramePartProfile } from './frame-composition';
import { getFrameFootprint } from './frame-outline';

const model: TerrainModelSettings = { widthMm: 150, lengthMm: 150, baseThicknessMm: 3 };
const overallHeightMm = 20;

function tier(overrides: Partial<FrameTier> = {}): FrameTier {
  return { offsetMm: 20, heightMm: 5, edge: { shape: 'square' }, part: 'separate', ...overrides };
}

function surround(overrides: Partial<FrameSurround> = {}): FrameSurround {
  return {
    borderWidthMm: 10,
    rimHeight: { reference: 'model-base', aboveMm: 4 },
    rimEdge: { shape: 'square' },
    innerEdge: { shape: 'square' },
    ...overrides,
  };
}

function frame(overrides: Partial<FrameSettings> = {}): FrameSettings {
  return {
    outline: 'match',
    clearanceMm: 0.3,
    tiers: [tier()],
    mounts: [],
    display: 'table',
    ...overrides,
  };
}

function compose(settings: FrameSettings): Result<FramePartProfile[]> {
  return composeFrameProfiles(getFrameFootprint(model), model, overallHeightMm, settings);
}

function expectParts(settings: FrameSettings): FramePartProfile[] {
  const result = compose(settings);

  if (!result.ok) {
    assert.fail(result.error.message);
  }

  return result.data;
}

function expectErrorMessage(settings: FrameSettings): string {
  const result = compose(settings);

  if (result.ok) {
    assert.fail('Expected the frame settings to be rejected.');
  }

  return result.error.message;
}

void test('a joined tier merges with the one below and a separate tier starts a new part', () => {
  const settings = frame({
    tiers: [
      tier({ offsetMm: 30, heightMm: 4 }),
      tier({ offsetMm: 20, heightMm: 4, part: 'join-below' }),
      tier({ offsetMm: 10, heightMm: 3 }),
    ],
  });
  const result = createFrameAssembly(model, overallHeightMm, settings);

  if (!result.ok) {
    assert.fail(result.error.message);
  }

  assert.deepEqual(
    result.data.parts.map(({ id }) => id),
    ['frame', 'frame-2'],
  );

  for (const part of result.data.parts) {
    validatePrintableSolid(part.solid);
  }
});

void test('a separate tier sits on the tiers below it', () => {
  const [, upper] = expectParts(
    frame({ tiers: [tier({ heightMm: 6 }), tier({ offsetMm: 10, heightMm: 3 })] }),
  );

  assert.deepEqual(upper.profile.points, [
    { offsetMm: 10, heightMm: 6 },
    { offsetMm: 10, heightMm: 9 },
  ]);
});

void test('a stacked pedestal steps in at each joined tier', () => {
  const [pedestal] = expectParts(
    frame({
      tiers: [
        tier({ offsetMm: 30, heightMm: 4 }),
        tier({ offsetMm: 20, heightMm: 4, part: 'join-below' }),
      ],
    }),
  );

  assert.deepEqual(pedestal.profile.points, [
    { offsetMm: 30, heightMm: 0 },
    { offsetMm: 30, heightMm: 4 },
    { offsetMm: 20, heightMm: 4 },
    { offsetMm: 20, heightMm: 8 },
  ]);
});

void test('a 1 mm chamfer spans 1 mm whatever the border and rim', () => {
  const [tray] = expectParts(
    frame({
      tiers: [tier({ offsetMm: 30.3, heightMm: 2 })],
      surround: surround({
        borderWidthMm: 30,
        rimHeight: { reference: 'model-base', aboveMm: 4 },
        rimEdge: { shape: 'chamfer', sizeMm: 1 },
      }),
    }),
  );

  assert.deepEqual(tray.profile.points.slice(1, 3), [
    { offsetMm: 30.3, heightMm: 8 },
    { offsetMm: 29.3, heightMm: 9 },
  ]);
});

void test('a rim measured from the model top stands that far below it', () => {
  const [tray] = expectParts(
    frame({
      tiers: [tier({ offsetMm: 10.3, heightMm: 2 })],
      surround: surround({ rimHeight: { reference: 'model-top', belowMm: 5 } }),
    }),
  );
  const rimTopMm = Math.max(...tray.profile.points.map(({ heightMm }) => heightMm));

  assert.equal(rimTopMm - 2, 15);
});

void test('a tray on a plinth steps out to the wider plinth tier', () => {
  const [part] = expectParts(
    frame({
      tiers: [tier({ offsetMm: 20, heightMm: 3, edge: { shape: 'chamfer', sizeMm: 1 } })],
      surround: surround(),
    }),
  );

  assert.deepEqual(part.profile.points.slice(0, 5), [
    { offsetMm: 20, heightMm: 0 },
    { offsetMm: 20, heightMm: 2 },
    { offsetMm: 19, heightMm: 3 },
    { offsetMm: 10.3, heightMm: 3 },
    { offsetMm: 10.3, heightMm: 10 },
  ]);
});

void test('no tiers and no surround compose no parts', () => {
  assert.deepEqual(expectParts(frame({ tiers: [] })), []);
});

for (const [name, settings, pattern] of [
  [
    'a bottom tier that joins below',
    frame({ tiers: [tier({ part: 'join-below' })] }),
    /Tier 1: the bottom tier/,
  ],
  [
    'a foot on a joined tier',
    frame({
      tiers: [tier(), tier({ part: 'join-below', footEdge: { shape: 'undercut', sizeMm: 1 } })],
    }),
    /Tier 2: only a tier that starts a part/,
  ],
  [
    'an edge taller than its tier',
    frame({ tiers: [tier({ heightMm: 2, edge: { shape: 'round', sizeMm: 3 } })] }),
    /Tier 1: edge sizeMm 3 is taller than the 2 mm face/,
  ],
  ['a surround with no tier under it', frame({ tiers: [], surround: surround() }), /needs a tier/],
  ['a shadow-box lip', frame({ surround: surround({ lipMm: 3 }) }), /lipMm/],
  [
    'an undercut taller than the straight wall',
    frame({ tiers: [tier({ heightMm: 3, footEdge: { shape: 'undercut', sizeMm: 4 } })] }),
    /straight wall above the foot is 3 mm/,
  ],
  [
    'a tier edge that cuts past the centre',
    frame({
      tiers: [tier({ offsetMm: -70, heightMm: 10, edge: { shape: 'chamfer', sizeMm: 6 } })],
    }),
    /collapses its outline/,
  ],
  [
    'a part thinner than 1.2 mm',
    frame({ tiers: [tier({ heightMm: 0.8 })] }),
    /Part frame is 0\.8 mm thick/,
  ],
  [
    'a rim that resolves below the floor',
    frame({ surround: surround({ rimHeight: { reference: 'model-top', belowMm: 25 } }) }),
    /resolves to -5 mm/,
  ],
  [
    'an unknown edge shape',
    frame({ tiers: [tier({ edge: { shape: 'bevel' as 'chamfer', sizeMm: 1 } })] }),
    /square, chamfer, cove, round, ogee, step/,
  ],
  [
    'a zero-size edge',
    frame({ tiers: [tier({ edge: { shape: 'cove', sizeMm: 0 } })] }),
    /edge sizeMm must be above 0/,
  ],
  ['a non-finite clearance', frame({ clearanceMm: Number.NaN }), /clearanceMm/],
] as const) {
  void test(`${name} is rejected`, () => {
    assert.match(expectErrorMessage(settings), pattern);
  });
}
