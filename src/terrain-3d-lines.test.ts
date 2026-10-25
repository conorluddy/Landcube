import assert from 'node:assert/strict';
import { test } from 'node:test';
import { versionOneDesignDefaults } from './constants/design';
import { createTerrainLineBuffers } from './terrain-3d-lines';
import type { Contour } from './types/contours';

void test('3D contours share solid and dashed index alternation across zero', () => {
  const contours: Contour[] = Array.from({ length: 9 }, (_, index) => ({
    elevation: index - 4,
    paths: [
      {
        points: [
          { x: index, y: 0 },
          { x: index, y: 10 },
        ],
        closed: false,
      },
    ],
  }));
  const settings = {
    ...versionOneDesignDefaults,
    indexStyle: 'alternating' as const,
    indexEvery: 2,
  };
  const groups = createTerrainLineBuffers(contours, 10, 10, settings);

  assert.equal(groups.ordinary.positions.length / 6, 4);
  assert.equal(groups.solid.positions.length / 6, 3);
  assert.equal(groups.dashed.positions.length / 6, 2);
  const off = createTerrainLineBuffers(contours, 10, 10, { ...settings, indexStyle: 'off' });

  assert.equal(off.ordinary.positions.length / 6, 9);
  assert.equal(off.dashed.positions.length, 0);
  assert.equal(off.solid.positions.length, 0);
  const dashed = createTerrainLineBuffers(contours, 10, 10, { ...settings, indexStyle: 'dashed' });

  assert.equal(dashed.dashed.positions.length / 6, 5);
  assert.equal(dashed.solid.positions.length, 0);
});

void test('dash distances preserve clipping phase, accumulate along paths and restart for disconnected paths', () => {
  const contours: Contour[] = [
    {
      elevation: 0,
      paths: [
        {
          points: [
            { x: -5, y: 5 },
            { x: 5, y: 5 },
            { x: 15, y: 5 },
          ],
          closed: false,
        },
        {
          points: [
            { x: 2, y: 2 },
            { x: 5, y: 2 },
            { x: 5, y: 6 },
          ],
          closed: true,
        },
      ],
    },
  ];
  const groups = createTerrainLineBuffers(contours, 10, 10, {
    ...versionOneDesignDefaults,
    indexStyle: 'dashed',
  });

  assert.deepEqual(groups.dashed.distanceStarts, [5, 10, 0, 3, 7]);
  assert.deepEqual(groups.dashed.distanceEnds, [10, 15, 3, 7, 12]);
  assert.equal(groups.dashed.positions.length / 6, 5);
});
