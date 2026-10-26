import assert from 'node:assert/strict';
import { test } from 'node:test';
import { terrainCircleSegments } from '../terrain-crop';
import { createOutlineRing } from './frame-outline';

void test('circular rings use the terrain circle angles', () => {
  const ring = createOutlineRing({ shape: 'circle', radiusMm: 75 }, 0.3);

  assert.equal(ring.length, terrainCircleSegments);

  ring.forEach(({ x, z }, segment) => {
    const angle = (segment / terrainCircleSegments) * Math.PI * 2;

    assert.equal(x, Math.cos(angle) * 75.3);
    assert.equal(z, Math.sin(angle) * 75.3);
  });
});

void test('rectangular rings offset every side by the same distance', () => {
  const ring = createOutlineRing({ shape: 'rectangle', halfWidthMm: 60, halfLengthMm: 40 }, 2);

  assert.deepEqual(ring, [
    { x: 62, z: 42 },
    { x: -62, z: 42 },
    { x: -62, z: -42 },
    { x: 62, z: -42 },
  ]);
});

void test('a collapsed ring is an invariant failure', () => {
  assert.throws(() => createOutlineRing({ shape: 'circle', radiusMm: 5 }, -5), /half-extent 0 mm/);
});
