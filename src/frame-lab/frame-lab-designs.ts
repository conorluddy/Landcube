import { frameProfilePresets } from '../constants/frame';
import { createTrayPresetFrame } from '../frame/frame-presets';
import type { TerrainModelSettings } from '../terrain-model';
import type { FrameSettings, FrameSurround, FrameTier } from '../types/frame';

export interface FrameLabDesign {
  name: string;
  frame: FrameSettings;
}

export const frameLabModel: TerrainModelSettings = {
  widthMm: 150,
  lengthMm: 150,
  baseThicknessMm: 3,
};
export const frameLabOverallHeightMm = 24;

// === PUBLIC API ===

/** The #34 presets, then composed looks that only tiers and a surround can express. */
export function createFrameLabDesigns(): FrameLabDesign[] {
  return [
    ...frameProfilePresets.map((preset) => ({
      name: `Tray: ${preset}`,
      frame: createTrayPresetFrame(preset, frameLabModel),
    })),
    {
      name: 'Tray: ogee, rim to model top − 6',
      frame: tray({
        rimEdge: { shape: 'ogee', sizeMm: 4 },
        rimHeight: { reference: 'model-top', belowMm: 6 },
      }),
    },
    {
      name: 'Tray: round rim, chamfered opening',
      frame: tray({
        rimEdge: { shape: 'round', sizeMm: 3 },
        innerEdge: { shape: 'chamfer', sizeMm: 1 },
      }),
    },
    {
      name: 'Pedestal',
      frame: frame([tier(14, 8, { shape: 'chamfer', sizeMm: 2 })]),
    },
    {
      name: 'Stacked pedestal',
      frame: frame([
        tier(24, 5, { shape: 'cove', sizeMm: 3 }),
        tier(14, 5, { shape: 'round', sizeMm: 2 }, 'join-below'),
      ]),
    },
    {
      name: 'Two-colour pedestal (separate tiers)',
      frame: frame([
        tier(24, 5, { shape: 'chamfer', sizeMm: 1 }),
        tier(12, 4, { shape: 'step', sizeMm: 2 }),
      ]),
    },
    {
      name: 'Tray on a plinth',
      frame: {
        ...frame([tier(22, 4, { shape: 'chamfer', sizeMm: 1.5 })]),
        surround: surround({ rimEdge: { shape: 'chamfer', sizeMm: 1 } }),
      },
    },
    {
      name: 'Floating toe pedestal',
      frame: frame([
        {
          ...tier(16, 10, { shape: 'round', sizeMm: 2 }),
          footEdge: { shape: 'undercut', sizeMm: 4 },
        },
      ]),
    },
    {
      name: '✗ Joined tier wider than its base',
      frame: frame([
        tier(10, 4, { shape: 'square' }),
        tier(20, 4, { shape: 'square' }, 'join-below'),
      ]),
    },
  ];
}

// === HELPERS ===

function tier(
  offsetMm: number,
  heightMm: number,
  edge: FrameTier['edge'],
  part: FrameTier['part'] = 'separate',
): FrameTier {
  return { offsetMm, heightMm, edge, part };
}

function surround(overrides: Partial<FrameSurround> = {}): FrameSurround {
  return {
    borderWidthMm: 10,
    rimHeight: { reference: 'model-base', aboveMm: 4 },
    rimEdge: { shape: 'square' },
    innerEdge: { shape: 'square' },
    ...overrides,
  };
}

function frame(tiers: FrameTier[]): FrameSettings {
  return { outline: 'match', clearanceMm: 0.3, tiers, mounts: [], display: 'table' };
}

function tray(overrides: Partial<FrameSurround>): FrameSettings {
  return { ...frame([tier(10.3, 2, { shape: 'square' })]), surround: surround(overrides) };
}
