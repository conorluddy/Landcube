import assert from 'node:assert/strict';
import { test } from 'node:test';
import { terrainCircleSegments } from '../terrain-crop';
import { validatePrintableSolid } from '../export/stl-export';
import type { FrameFootprint } from '../types/frame';
import { sweepFrameProfile } from './frame-sweep';

const slabProfile = [
  { offsetMm: 5, heightMm: 0 },
  { offsetMm: 5, heightMm: 2 },
];

for (const footprint of [
  { shape: 'rectangle', halfWidthMm: 30, halfLengthMm: 10 },
  { shape: 'circle', radiusMm: 20 },
] satisfies FrameFootprint[]) {
  void test(`a two-point profile around a ${footprint.shape} sweeps to a closed slab`, () => {
    const solid = sweepFrameProfile(footprint, slabProfile);

    validatePrintableSolid(solid);
    const ringSize = footprint.shape === 'circle' ? terrainCircleSegments : 4;

    assert.equal(solid.positions.length / 3, ringSize * 2 + 2);
    assert.equal(solid.indices.length / 3, ringSize * 4);
  });
}
