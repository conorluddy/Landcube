import { designPalettePresets } from '../constants/palettes';
import { createSvgDocument } from '../svg-rendering';
import type { Contour, ContourPoint } from '../types/contours';
import type { SeaLevelGeometry } from '../sea-level';
import type { DesignSettings } from '../types/design';

export type ComparePresetId = keyof typeof designPalettePresets;

/** Everything the pipeline produced for the viewport, minus the appearance. Side B re-styles it. */
export interface CompareScene {
  contours: Contour[];
  width: number;
  height: number;
  summits: readonly ContourPoint[];
  seaLevel?: SeaLevelGeometry;
}

export const comparePresetIds = Object.keys(designPalettePresets) as ComparePresetId[];
export const defaultDividerFraction = 0.5;

// === PUBLIC API ===
export function isComparePresetId(presetId: string): presetId is ComparePresetId {
  return Object.hasOwn(designPalettePresets, presetId);
}

/** The preset patch, the same one the Colour tiles and the Presets page apply. */
export function getComparePresetPatch(presetId: ComparePresetId): Partial<DesignSettings> {
  return designPalettePresets[presetId];
}

/** The design as it would look with the preset applied. Appearance only: geometry is untouched. */
export function buildCompareDesign(
  design: Readonly<DesignSettings>,
  presetId: ComparePresetId,
): DesignSettings {
  return { ...design, ...getComparePresetPatch(presetId) };
}

export function clampDivider(fraction: number): number {
  return Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : defaultDividerFraction;
}

/** True when the preset is already what the design shows, as the Colour tiles decide it. */
export function isPresetApplied(
  design: Readonly<DesignSettings>,
  presetId: ComparePresetId,
): boolean {
  const preset = designPalettePresets[presetId];

  return preset.background === design.background && preset.lineColor === design.lineColor;
}

/**
 * Side B: the shared SVG pipeline run over the live scene with the preset applied. Element ids
 * are renamed because side B shares the document with the live SVG, whose grid pattern would
 * otherwise win the `url(#terrain-grid)` lookup.
 */
export function renderCompareSvg(
  scene: CompareScene,
  design: Readonly<DesignSettings>,
  presetId: ComparePresetId,
): string {
  const compareDesign = {
    ...buildCompareDesign(design, presetId),
    width: scene.width,
    height: scene.height,
  };

  return createSvgDocument(scene.contours, compareDesign, scene.summits, undefined, scene.seaLevel)
    .replaceAll('terrain-grid', 'compare-terrain-grid')
    .replaceAll('landscape-crop', 'compare-landscape-crop');
}
