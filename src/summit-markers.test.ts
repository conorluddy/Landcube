import assert from 'node:assert/strict';
import test from 'node:test';
import { versionOneDesignDefaults } from './constants/design';
import { parseDesignParameters, serializeDesignParameters } from './design-settings';
import { createSummitMarkerMarkup, findTerrainSummits } from './summit-markers';
import { createSvgDocument } from './svg-rendering';
import type { HeightField } from './types/terrain';

const field: HeightField = {
  columns: 3,
  rows: 3,
  spacing: 10,
  originX: 20,
  originY: 30,
  values: new Float64Array([0, 1, 0, 1, 3, 1, 0, 1, 0]),
};

void test('finds a local summit in world coordinates and excludes flat terrain and depressions', () => {
  assert.deepEqual(findTerrainSummits(field), [{ x: 30, y: 40 }]);
  assert.deepEqual(findTerrainSummits({ ...field, values: new Float64Array(9).fill(1) }), []);
  assert.deepEqual(
    findTerrainSummits({ ...field, values: field.values.map((value) => -value) }),
    [],
  );
});

void test('summit triangles and crosses can each be enabled independently without labels', () => {
  const summits = findTerrainSummits(field);

  assert.equal(createSummitMarkerMarkup(summits, versionOneDesignDefaults), '');

  for (const summitTrianglesEnabled of [false, true]) {
    for (const summitCrossesEnabled of [false, true]) {
      const settings = {
        ...versionOneDesignDefaults,
        summitTrianglesEnabled,
        summitCrossesEnabled,
      };
      const svg = createSvgDocument([], settings, summits);

      assert.equal(svg.includes('M0,-7L6,4L-6,4Z'), summitTrianglesEnabled);
      assert.equal(svg.includes('M-2.5,0H2.5M0,-2.5V2.5'), summitCrossesEnabled);
      assert.equal(svg.includes('<text'), false);
    }
  }
});

void test('shared designs preserve both independent marker toggles', () => {
  const settings = {
    ...versionOneDesignDefaults,
    summitTrianglesEnabled: true,
    summitCrossesEnabled: false,
  };
  const result = parseDesignParameters(serializeDesignParameters(settings));

  assert.equal(result.ok, true);
  assert.equal(result.data.settings.summitTrianglesEnabled, true);
  assert.equal(result.data.settings.summitCrossesEnabled, false);
});

void test('S preserves the original marker size while M and L scale both symbols around each summit', () => {
  for (const [summitMarkerSize, scale] of [
    ['S', 1],
    ['M', 1.5],
    ['L', 2],
  ] as const) {
    const settings = {
      ...versionOneDesignDefaults,
      summitTrianglesEnabled: true,
      summitCrossesEnabled: true,
      summitMarkerSize,
    };
    const svg = createSvgDocument([], settings, [{ x: 30, y: 40 }]);

    assert.ok(svg.includes(`translate(30,40) scale(${scale})`));
    assert.ok(svg.includes('M0,-7L6,4L-6,4Z'));
    assert.ok(svg.includes('M-2.5,0H2.5M0,-2.5V2.5'));
    const result = parseDesignParameters(serializeDesignParameters(settings));

    assert.equal(result.ok, true);
    assert.equal(result.data.settings.summitMarkerSize, summitMarkerSize);
  }
});

void test('missing or unsupported summit sizes fall back to S', () => {
  for (const parameters of [
    new URLSearchParams(),
    new URLSearchParams({ summitMarkerSize: 'XL' }),
  ]) {
    const result = parseDesignParameters(parameters);

    assert.equal(result.ok, true);
    assert.equal(result.data.settings.summitMarkerSize, 'S');
    assert.deepEqual(
      result.data.warnings,
      parameters.has('summitMarkerSize') ? ['summitMarkerSize'] : [],
    );
  }
});
