import assert from 'node:assert/strict';
import test from 'node:test';
import { designPalettePresets } from '../constants/palettes';
import { versionOneDesignDefaults } from '../constants/design';
import { engineConfiguration } from '../constants/engine';
import { generateLandscapeGeometry } from '../landscape-composition';
import { createSvgDocument } from '../svg-rendering';
import { validateDesignSettings } from '../design-settings';
import { createStudioController } from './controller';
import {
  buildCompareDesign,
  clampDivider,
  isComparePresetId,
  isPresetApplied,
  renderCompareSvg,
  type CompareScene,
} from './wipe-compare';

const design = { ...versionOneDesignDefaults, seed: 123, width: 480, height: 320 };
const geometry = generateLandscapeGeometry(design, engineConfiguration);
const scene: CompareScene = { ...geometry, width: design.width, height: design.height };

function pathData(svg: string): string[] {
  return [...svg.matchAll(/ d="([^"]*)"/g)].map(([, data]) => data);
}

void test('buildCompareDesign changes only the preset appearance', () => {
  const compared = buildCompareDesign(design, 'Paper');

  assert.equal(compared.background, designPalettePresets.Paper.background);
  assert.equal(compared.lineColor, designPalettePresets.Paper.lineColor);
  assert.equal(compared.seed, design.seed);
  assert.equal(compared.contourCount, design.contourCount);
  assert.ok(validateDesignSettings(compared).ok);
});

void test('side B has the same geometry as side A and only the palette differs', () => {
  const sideA = createSvgDocument(scene.contours, design, scene.summits, undefined, scene.seaLevel);
  const sideB = renderCompareSvg(scene, design, 'Blueprint');

  assert.ok(pathData(sideA).length > 0);
  assert.deepEqual(pathData(sideB), pathData(sideA));
  assert.notEqual(sideB, sideA);
  assert.ok(sideB.includes(designPalettePresets.Blueprint.background));
  assert.ok(sideB.includes(designPalettePresets.Blueprint.lineColor));

  const stripPalette = (svg: string) =>
    svg
      .replace(/ (?:stroke|fill|stroke-width|stroke-opacity)="[^"]*"/g, '')
      .replaceAll('compare-', '');

  assert.equal(stripPalette(sideB), stripPalette(sideA));
});

void test('side B is byte-identical on every render', () => {
  assert.equal(renderCompareSvg(scene, design, 'Bold'), renderCompareSvg(scene, design, 'Bold'));
});

void test('side B renames ids so its grid pattern cannot resolve to the live SVG', () => {
  const sideB = renderCompareSvg(scene, { ...design, gridStyle: 'squares' }, 'Paper');

  assert.ok(sideB.includes('id="compare-terrain-grid"'));
  assert.ok(sideB.includes('url(#compare-terrain-grid)'));
  assert.ok(!sideB.includes('"terrain-grid"'));
  assert.ok(sideB.includes('url(#compare-landscape-crop)'));
});

void test('clampDivider keeps the divider inside the viewport', () => {
  assert.equal(clampDivider(-0.2), 0);
  assert.equal(clampDivider(1.4), 1);
  assert.equal(clampDivider(0.37), 0.37);
  assert.equal(clampDivider(Number.NaN), 0.5);
});

void test('isPresetApplied follows the palette tiles: background and line colour', () => {
  assert.equal(isPresetApplied(buildCompareDesign(design, 'Paper'), 'Paper'), true);
  assert.equal(isPresetApplied(design, 'Paper'), false);
  assert.equal(isComparePresetId('Paper'), true);
  assert.equal(isComparePresetId('toString'), false);
});

function setupController() {
  let current = validateDesignSettings(design);

  assert.ok(current.ok);

  return createStudioController({
    getSettings: () => {
      assert.ok(current.ok);

      return current.data;
    },
    updateSettings: (candidate) => {
      const result = validateDesignSettings(candidate);

      if (result.ok) {
        current = result;
      }

      return result.ok;
    },
    newLandscape: () => undefined,
    isSeedLocked: false,
    lockSeed: () => undefined,
    getShareUrl: () => '',
    copyLink: () => Promise.resolve({ ok: true, data: undefined }),
  });
}

void test('compare actions start, clamp the divider, apply through design() and end', () => {
  const c = setupController();

  assert.equal(c.getSnapshot().workspace.compare, null);
  c.moveDivider(0.9);
  assert.equal(c.getSnapshot().workspace.compare, null);
  c.startCompare('NotAPreset');
  assert.equal(c.getSnapshot().workspace.compare, null);
  c.startCompare('Paper');
  assert.deepEqual(c.getSnapshot().workspace.compare, { presetId: 'Paper', dividerFraction: 0.5 });
  c.moveDivider(2);
  assert.equal(c.getSnapshot().workspace.compare?.dividerFraction, 1);
  c.startCompare('Bold');
  assert.deepEqual(c.getSnapshot().workspace.compare, { presetId: 'Bold', dividerFraction: 1 });
  c.endCompare();
  assert.equal(c.getSnapshot().workspace.compare, null);
  c.startCompare('Paper');
  c.applyCompare();
  assert.equal(c.getSnapshot().workspace.compare, null);
  assert.equal(c.getSnapshot().design.background, designPalettePresets.Paper.background);
});
