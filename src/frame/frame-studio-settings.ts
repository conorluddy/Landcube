import { defaultTrayFloorThicknessMm } from '../constants/frame';
import type { FrameEdge, FrameEdgeShape, FrameSettings, FrameTier } from '../types/frame';

export type FrameStudioPreset =
  'none' | 'tray' | 'pedestal' | 'stacked-pedestal' | 'tray-on-plinth';

/** Preview colour only; prints take whatever filament is loaded. */
export type FrameFinish = 'light-wood' | 'dark-wood' | 'white' | 'black' | 'concrete';

/** The Frame tab's few controls. Session-only, like model settings, and never in links. */
export interface FrameStudioSettings {
  preset: FrameStudioPreset;
  edgeShape: 'square' | FrameEdgeShape;
  edgeSizeMm: number;
  /** Tray: the surround wall. Pedestals: how far the stand reaches past the model. */
  borderWidthMm: number;
  /** Trays: rim height above the model's base. */
  rimAboveBaseMm: number;
  /** Pedestals and plinths: the stand's height. */
  standHeightMm: number;
  clearanceMm: number;
  hasFloatingToe: boolean;
  finish: FrameFinish;
}

export const frameStudioPresets: readonly { value: FrameStudioPreset; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'tray', label: 'Tray' },
  { value: 'pedestal', label: 'Pedestal' },
  { value: 'stacked-pedestal', label: 'Stacked pedestal' },
  { value: 'tray-on-plinth', label: 'Tray on a plinth' },
];

export const frameFinishes: Readonly<
  Record<FrameFinish, { label: string; color: string; roughness: number }>
> = {
  'light-wood': { label: 'Light wood', color: '#c9a37a', roughness: 0.65 },
  'dark-wood': { label: 'Dark wood', color: '#5a3a24', roughness: 0.6 },
  white: { label: 'White', color: '#ecebe6', roughness: 0.5 },
  black: { label: 'Black', color: '#222326', roughness: 0.45 },
  concrete: { label: 'Concrete', color: '#9a9893', roughness: 0.95 },
};

export const defaultFrameStudioSettings: Readonly<FrameStudioSettings> = Object.freeze({
  preset: 'none',
  edgeShape: 'square',
  edgeSizeMm: 2,
  borderWidthMm: 10,
  rimAboveBaseMm: 4,
  standHeightMm: 8,
  clearanceMm: 0.3,
  hasFloatingToe: false,
  finish: 'dark-wood',
});

/** A 45° toe this tall reads as a shadow line at arm's length. */
export const floatingToeMm = 2;

/** Depth of the locating recess a pedestal holds the model in (#35 REQ-6). */
export const pedestalRecessDepthMm = 1.5;

// === PUBLIC API ===

/**
 * Expands the tab's controls into composable frame settings. `none` gives no tiers, so the
 * assembly is empty. Validation stays with `createFrameAssembly`.
 */
export function createStudioFrame(settings: FrameStudioSettings): FrameSettings {
  const edge = createEdge(settings);
  const edgeSizeMm = edge.shape === 'square' ? 0 : edge.sizeMm;
  const outerOffsetMm = settings.clearanceMm + settings.borderWidthMm;
  const footEdge = settings.hasFloatingToe
    ? { shape: 'undercut' as const, sizeMm: floatingToeMm }
    : undefined;
  const base = {
    outline: 'match',
    clearanceMm: settings.clearanceMm,
    mounts: [],
    display: 'table',
  } as const;
  const trayRim = { reference: 'model-base', aboveMm: settings.rimAboveBaseMm } as const;
  // The recess lip sits inside the stand's top edge so the edge has a face to cut.
  const recess = {
    borderWidthMm: settings.borderWidthMm - edgeSizeMm,
    rimHeight: { reference: 'floor', heightMm: pedestalRecessDepthMm },
    rimEdge: { shape: 'square' },
    innerEdge: { shape: 'square' },
  } as const;

  switch (settings.preset) {
    case 'none':
      return { ...base, tiers: [] };
    case 'tray':
      return {
        ...base,
        tiers: [tier(outerOffsetMm, defaultTrayFloorThicknessMm, { shape: 'square' }, footEdge)],
        surround: surround(settings.borderWidthMm, trayRim, edge),
      };
    case 'pedestal':
      return {
        ...base,
        tiers: [tier(outerOffsetMm, settings.standHeightMm, edge, footEdge)],
        surround: recess,
      };
    case 'stacked-pedestal':
      return {
        ...base,
        tiers: [
          tier(
            outerOffsetMm + settings.borderWidthMm / 2,
            settings.standHeightMm / 2,
            edge,
            footEdge,
          ),
          { ...tier(outerOffsetMm, settings.standHeightMm / 2, edge), part: 'join-below' },
        ],
        surround: recess,
      };
    case 'tray-on-plinth':
      return {
        ...base,
        tiers: [
          tier(outerOffsetMm + settings.borderWidthMm / 2, settings.standHeightMm, edge, footEdge),
        ],
        surround: surround(settings.borderWidthMm, trayRim, edge),
      };
  }
}

// === HELPERS ===

function createEdge(settings: FrameStudioSettings): FrameEdge {
  return settings.edgeShape === 'square'
    ? { shape: 'square' }
    : { shape: settings.edgeShape, sizeMm: settings.edgeSizeMm };
}

function tier(
  offsetMm: number,
  heightMm: number,
  edge: FrameEdge,
  footEdge?: FrameTier['footEdge'],
): FrameTier {
  return { offsetMm, heightMm, edge, footEdge, part: 'separate' };
}

function surround(
  borderWidthMm: number,
  rimHeight: { reference: 'model-base'; aboveMm: number },
  rimEdge: FrameEdge,
): NonNullable<FrameSettings['surround']> {
  return { borderWidthMm, rimHeight, rimEdge, innerEdge: { shape: 'square' } };
}
