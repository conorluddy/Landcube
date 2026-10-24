import assert from 'node:assert/strict';
import test from 'node:test';
import { versionOneDesignDefaults } from './constants/design';
import { parseDesignParameters, serializeDesignParameters } from './design-settings';
import { createSvgDocument } from './svg-rendering';
import type { Contour } from './types/contours';

void test('alternating index contours keep ordinary lines solid and alternate across zero elevation', () => {
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
  const svg = createSvgDocument(contours, {
    ...versionOneDesignDefaults,
    indexStyle: 'alternating',
    indexEvery: 2,
    indexStrokeWidth: 2,
    dashLength: 9,
    dashGap: 3,
  });
  const paths = [...svg.matchAll(/<path[^>]*>/g)].map(([markup]) => markup);

  assert.equal(paths.length, 3);
  assert.match(paths[0], /stroke-width="0.85"/);
  assert.doesNotMatch(paths[0], /stroke-dasharray/);
  assert.match(paths[0], /M1.000,0.000/);
  assert.match(paths[1], /stroke-width="2"/);
  assert.doesNotMatch(paths[1], /stroke-dasharray/);

  for (const x of [0, 4, 8]) {
    assert.ok(paths[1].includes(`M${x}.000,0.000`));
  }

  assert.match(paths[2], /stroke-width="2"/);
  assert.match(paths[2], /stroke-dasharray="9 3"/);

  for (const x of [2, 6]) {
    assert.ok(paths[2].includes(`M${x}.000,0.000`));
  }
});

void test('shared designs restore the alternating index style', () => {
  const settings = { ...versionOneDesignDefaults, indexStyle: 'alternating' as const };
  const result = parseDesignParameters(serializeDesignParameters(settings));

  assert.equal(result.ok, true);
  assert.equal(result.data.settings.indexStyle, 'alternating');
  assert.deepEqual(result.data.warnings, []);
});
