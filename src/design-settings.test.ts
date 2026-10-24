import { designNumberConstraints, versionOneDesignDefaults } from './constants/design';
import { engineConfiguration } from './constants/engine';
import {
  classifyDesignSettingChange,
  deriveTerrainConfiguration,
  getDesignUrl,
  parseDesignParameters,
  resetDesignStyle,
  serializeDesignParameters,
  validateDesignSettings,
} from './design-settings';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const customized = {
  ...versionOneDesignDefaults,
  seed: 4294967295,
  background: '#abc123',
  lineColor: '#f0eeee',
  strokeOpacity: 0.64,
  strokeWidth: 1.25,
  contourCount: 35,
  featureScale: 410,
  detail: 0.57,
  indexStyle: 'off' as const,
  indexEvery: 7,
  indexStrokeWidth: 2.3,
  dashLength: 16,
  dashGap: 11,
  cursorEnabled: false,
  cursorRadius: 240,
  cursorHeight: -0.36,
  cursorResponseMs: 340,
  format: 'png' as const,
  width: 900,
  height: 1600,
  pngScale: 2 as const,
  transparent: true,
};

await test('a complete design survives a share link, including inactive index and cursor settings', () => {
  /** Verifies a complete design survives a share link, including inactive index and cursor settings. */
  const url = getDesignUrl('https://topogra.example/studio?old=value#design', customized);
  const parsed = parseDesignParameters(new URL(url).searchParams);
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.data.settings, customized);
  assert.deepEqual(parsed.data.warnings, []);
  assert.equal(new URL(url).pathname, '/studio');
  assert.equal(new URL(url).hash, '#design');
  assert.equal(new URL(url).searchParams.has('old'), false);
  assert.equal(new URL(url).searchParams.get('v'), '1');
  assert.equal(new URL(url).searchParams.size, Object.keys(versionOneDesignDefaults).length + 1);
  assert.ok(Object.isFrozen(parsed.data.settings));
});

await test('partial links use stable version-one defaults', () => {
  /** Verifies partial links use stable version-one defaults. */
  const result = parseDesignParameters(new URLSearchParams('seed=12&lineColor=%23ABCDEF'));
  assert.ok(result.ok);
  assert.deepEqual(result.data.settings, {
    ...versionOneDesignDefaults,
    seed: 12,
    lineColor: '#abcdef',
  });
});

for (const [key, [min, max, step]] of Object.entries(designNumberConstraints)) {
  await test(`${key} accepts supported boundaries and rejects malformed, out-of-range, and off-step values`, () => {
    for (const value of [min, max, Number((min + step).toFixed(4))]) {
      const result = parseDesignParameters(new URLSearchParams({ [key]: String(value) }));
      assert.ok(result.ok);
      assert.deepEqual(result.data.warnings, []);
      assert.equal(result.data.settings[key as keyof typeof designNumberConstraints], value);
    }
    for (const raw of [
      '',
      'NaN',
      'Infinity',
      '1e2',
      '12px',
      String(min - step),
      String(max + step),
      String(min + step / 2),
    ]) {
      const result = parseDesignParameters(new URLSearchParams({ [key]: raw }));
      assert.ok(result.ok);
      assert.deepEqual(result.data.warnings, [key]);
      assert.equal(
        result.data.settings[key as keyof typeof designNumberConstraints],
        versionOneDesignDefaults[key as keyof typeof designNumberConstraints],
      );
    }
  });
}

await test('invalid colours, booleans and enums fall back without losing valid fields', () => {
  /** Verifies invalid colours, booleans and enums fall back without losing valid fields. */
  const invalid = {
    seed: '42',
    background: '<script>',
    lineColor: '#fff',
    cursorEnabled: 'yes',
    transparent: '0',
    indexStyle: 'heavy',
    format: 'jpg',
    pngScale: '3',
  };
  const result = parseDesignParameters(new URLSearchParams(invalid));
  assert.ok(result.ok);
  assert.deepEqual(result.data.settings, { ...versionOneDesignDefaults, seed: 42 });
  assert.equal(result.data.warnings.length, 7);
  assert.ok(validateDesignSettings(customized).ok);
  assert.equal(validateDesignSettings({ ...customized, width: 12 }).ok, false);
});

await test('unsupported versions return an actionable typed error', () => {
  /** Verifies unsupported versions return an actionable typed error. */
  const result = parseDesignParameters(new URLSearchParams('v=2&seed=56'));
  assert.ok(!result.ok);
  assert.equal(result.error.code, 'UNSUPPORTED_VERSION');
  assert.match(result.error.message, /v=1/);
});

await test('reset preserves the seed and output options while resetting style and cursor settings', () => {
  assert.deepEqual(resetDesignStyle(customized), {
    ...versionOneDesignDefaults,
    seed: customized.seed,
    format: 'png',
    width: 900,
    height: 1600,
    pngScale: 2,
    transparent: true,
  });
});

await test('terrain detail has a constant total amplitude and does not mutate engine constants', () => {
  /** Verifies terrain detail has a constant total amplitude and does not mutate engine constants. */
  for (const detail of [0, 0.32, 1]) {
    const derived = deriveTerrainConfiguration(
      { ...versionOneDesignDefaults, detail },
      engineConfiguration,
    );
    assert.ok(
      Math.abs(derived.noiseOctaves.reduce((sum, octave) => sum + octave.amplitude, 0) - 1) < 1e-12,
    );
    assert.equal(derived.maxSamples, engineConfiguration.maxSamples);
  }
  assert.ok(Object.isFrozen(engineConfiguration));
  assert.ok(Object.isFrozen(versionOneDesignDefaults));
});

await test('settings changes select the necessary update without regenerating terrain for output or appearance', () => {
  for (const key of Object.keys(
    versionOneDesignDefaults,
  ) as (keyof typeof versionOneDesignDefaults)[]) {
    const expected = ['seed', 'detail', 'featureScale'].includes(key)
      ? 'terrain'
      : key === 'contourCount'
        ? 'contours'
        : key.startsWith('cursor')
          ? 'cursor'
          : ['format', 'width', 'height', 'pngScale', 'transparent'].includes(key)
            ? 'output'
            : 'appearance';
    assert.equal(classifyDesignSettingChange(key), expected);
  }
  assert.equal(serializeDesignParameters(versionOneDesignDefaults).get('transparent'), 'false');
});
