import {
  defaultTrayBorderWidthMm,
  defaultTrayClearanceMm,
  defaultTrayFloorThicknessMm,
  trayWallAboveBaseMm,
} from '../constants/frame';
import type { TerrainModelSettings } from '../terrain-model';
import type { FrameEdge, FrameFootEdge, FrameProfilePreset, FrameSettings } from '../types/frame';

// === PUBLIC API ===

/** The default frame: a square tray whose rim clears the model's base by 4 mm. */
export function createDefaultFrame(model: TerrainModelSettings): FrameSettings {
  return createTrayPresetFrame('square', model);
}

/**
 * The #34 tray presets as named starting points: one floor tier plus a surround. Detail size
 * is half the smaller of border and wall, as #34 fixed it.
 */
export function createTrayPresetFrame(
  preset: FrameProfilePreset,
  model: TerrainModelSettings,
): FrameSettings {
  const wallHeightMm = model.baseThicknessMm + trayWallAboveBaseMm;
  const detailMm = Math.min(defaultTrayBorderWidthMm, wallHeightMm) / 2;
  const { rimEdge, footEdge } = getPresetEdges(preset, detailMm);

  return {
    outline: 'match',
    clearanceMm: defaultTrayClearanceMm,
    tiers: [
      {
        offsetMm: defaultTrayClearanceMm + defaultTrayBorderWidthMm,
        heightMm: defaultTrayFloorThicknessMm,
        edge: { shape: 'square' },
        footEdge,
        part: 'separate',
      },
    ],
    surround: {
      borderWidthMm: defaultTrayBorderWidthMm,
      rimHeight: { reference: 'model-base', aboveMm: trayWallAboveBaseMm },
      rimEdge,
      innerEdge: { shape: 'square' },
    },
    mounts: [],
    display: 'table',
  };
}

// === HELPERS ===

function getPresetEdges(
  preset: FrameProfilePreset,
  detailMm: number,
): { rimEdge: FrameEdge; footEdge: FrameFootEdge } {
  const square = { shape: 'square' } as const;

  switch (preset) {
    case 'square':
      return { rimEdge: square, footEdge: square };
    case 'chamfer':
      return { rimEdge: { shape: 'chamfer', sizeMm: detailMm }, footEdge: square };
    case 'cove':
      return { rimEdge: { shape: 'cove', sizeMm: detailMm }, footEdge: square };
    case 'stepped':
      return { rimEdge: { shape: 'step', sizeMm: detailMm }, footEdge: square };
    case 'floating':
      return { rimEdge: square, footEdge: { shape: 'undercut', sizeMm: detailMm } };
  }
}
