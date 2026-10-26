import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  copyElevationGradient,
  elevationGradientPresets,
  getElevationGradientCss,
  getLandscapeGradientKey,
  landscapeGradientPresets,
  mixElevationColors,
  validateElevationGradient,
  type ElevationGradientSettings,
} from './terrain-elevation-gradient';
import { realTerrainPresets } from './constants/real-terrain';

void test('every real-terrain location references an existing landscape gradient', () => {
  for (const location of realTerrainPresets) {
    assert.ok(
      getLandscapeGradientKey(location.landscape) in landscapeGradientPresets,
      `${location.name} has unknown landscape ${location.landscape}`,
    );
  }
});

void test('all elevation presets have valid editable stops and are copied independently', () => {
  for (const preset of [
    ...Object.values(elevationGradientPresets),
    ...Object.values(landscapeGradientPresets),
  ]) {
    const settings: ElevationGradientSettings = {
      enabled: true,
      transition: 'soft',
      stops: preset.stops,
    };

    validateElevationGradient(settings);
    const copy = copyElevationGradient(settings);

    assert.notEqual(copy.stops, settings.stops);
    assert.notEqual(copy.stops[0], settings.stops[0]);
    assert.match(getElevationGradientCss(copy), /in srgb-linear/);
    assert.ok(getElevationGradientCss(copy).includes(preset.stops[0].color));
  }
});

void test('hard transitions give both endpoint colors a band and meet midway between anchors', () => {
  const settings: ElevationGradientSettings = {
    enabled: true,
    transition: 'hard',
    stops: [
      { position: 0, color: '#000000' },
      { position: 0.4, color: '#ff0000' },
      { position: 1, color: '#ffffff' },
    ],
  };

  assert.equal(
    getElevationGradientCss(settings),
    'linear-gradient(90deg in srgb-linear, #000000 0%, #000000 20%, #ff0000 20%, #ff0000 70%, #ffffff 70%, #ffffff 100%)',
  );
  assert.equal(mixElevationColors('#000000', '#ffffff', 0.5), '#bcbcbc');
  assert.equal(mixElevationColors('#123456', '#abcdef', 0), '#123456');
  assert.equal(mixElevationColors('#123456', '#abcdef', 1), '#abcdef');
});

void test('invalid and overlapping stops are rejected before shader state changes', () => {
  const base: ElevationGradientSettings = {
    enabled: true,
    transition: 'soft',
    stops: [
      { position: 0, color: '#000000' },
      { position: 1, color: '#ffffff' },
    ],
  };

  for (const stops of [
    [],
    [{ position: 0, color: '#000000' }],
    [
      { position: 0.1, color: '#000000' },
      { position: 1, color: '#ffffff' },
    ],
    [
      { position: 0, color: '#000000' },
      { position: 0.5, color: '#ffffff' },
    ],
    [
      { position: 0, color: '#nope00' },
      { position: 1, color: '#ffffff' },
    ],
    [
      { position: 0, color: '#000000' },
      { position: NaN, color: '#ffffff' },
      { position: 1, color: '#ffffff' },
    ],
    [
      { position: 0, color: '#000000' },
      { position: 0.5, color: '#ffffff' },
      { position: 0.5, color: '#ffffff' },
      { position: 1, color: '#ffffff' },
    ],
    Array.from({ length: 7 }, (_, i) => ({ position: i / 6, color: '#ffffff' })),
  ]) {
    assert.throws(() => {
      validateElevationGradient({ ...base, stops });
    });
  }
});
