import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRandomPalette } from './random-palette';
import { validateDesignSettings } from './design-settings';
import { versionOneDesignDefaults } from './constants/design';

/** Decodes the canonical colours returned by the generator. */
function readChannels(color: string): number[] {
  return [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16));
}

/** Measures displayed relative luminance independently of palette generation. */
function luminance(channels: number[]): number {
  return channels.reduce((total, channel, index) => {
    const value = channel / 255;
    const linear = value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;

    return total + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
}

await test('random palettes retain at least 3:1 displayed contrast and valid design settings', () => {
  let seed = 17;

  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;

    return seed / 2 ** 32;
  };

  const backgrounds = new Set<string>();

  for (let index = 0; index < 1000; index++) {
    const palette = createRandomPalette(random);
    const background = readChannels(palette.background);
    const line = readChannels(palette.lineColor);
    const blended = line.map(
      (channel, position) =>
        channel * palette.strokeOpacity + background[position] * (1 - palette.strokeOpacity),
    );
    const luminances = [luminance(background), luminance(blended)];
    const contrast = (Math.max(...luminances) + 0.05) / (Math.min(...luminances) + 0.05);

    assert.ok(contrast >= 3, `Displayed contrast ${contrast} must be at least 3:1`);
    assert.ok(validateDesignSettings({ ...versionOneDesignDefaults, ...palette }).ok);
    backgrounds.add(palette.background);
  }

  assert.ok(backgrounds.size > 900);
});

await test('opposite hues produce complementary red and cyan palettes', () => {
  const palette = createRandomPalette(() => 0);
  const background = readChannels(palette.background);
  const contours = readChannels(palette.lineColor);

  assert.ok(background[0] > background[1]);
  assert.equal(background[1], background[2]);
  assert.ok(contours[0] < contours[1]);
  assert.equal(contours[1], contours[2]);
});
