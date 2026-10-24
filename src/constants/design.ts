import type { DesignSettings } from '../types/design';

export const designUrlVersion = '1';
export const maximumSeedValue = 0xffffffff;
export const minimumOutputDimensionPixels = 64;
export const maximumOutputDimensionPixels = 4096;
export const numericStepTolerance = 1e-6;
export const indexContourStyles = ['dashed', 'solid', 'off'] as const;
export const imageExportFormats = ['svg', 'png'] as const;
export const pngResolutionScales = [1, 2] as const;
export const terrainSettingKeys: readonly (keyof DesignSettings)[] = ['seed', 'featureScale', 'detail'];
export const outputSettingKeys = ['format', 'width', 'height', 'pngScale', 'transparent'] as const;

export const designChangePriority = { output: 0, appearance: 1, cursor: 2, contours: 3, terrain: 4 };

export const versionOneDesignDefaults: Readonly<DesignSettings> = Object.freeze({
  seed: 0, background: '#202326', lineColor: '#a4adb0', strokeWidth: 0.85, strokeOpacity: 0.29,
  contourCount: 23, featureScale: 260, detail: 0.32, indexStyle: 'dashed', indexEvery: 10,
  indexStrokeWidth: 0.85, dashLength: 7, dashGap: 5, cursorEnabled: true, cursorRadius: 190,
  cursorHeight: 0.32, cursorResponseMs: 120, format: 'svg', width: 1440, height: 900,
  pngScale: 1, transparent: false,
});

export const designNumberConstraints = {
  seed: [0, maximumSeedValue, 1], strokeWidth: [0.3, 3, 0.05], strokeOpacity: [0.05, 1, 0.01],
  contourCount: [7, 49, 2], featureScale: [120, 700, 10], detail: [0, 1, 0.01],
  indexEvery: [1, 15, 1], indexStrokeWidth: [0.3, 4, 0.05], dashLength: [1, 24, 1],
  dashGap: [1, 20, 1], cursorRadius: [60, 400, 10], cursorHeight: [-0.6, 0.6, 0.02],
  cursorResponseMs: [20, 500, 10], width: [minimumOutputDimensionPixels, maximumOutputDimensionPixels, 1], height: [minimumOutputDimensionPixels, maximumOutputDimensionPixels, 1],
} as const;
