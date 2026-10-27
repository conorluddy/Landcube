import type { rockPresets } from '../constants/rocks';

export type RockPresetKey = keyof typeof rockPresets;

/** Rocks in the 3D preview; colour edits never move a rock and shape edits never re-place one. */
export interface RockStyle {
  enabled: boolean;
  /** 'custom' once any colour or shape setting is edited by hand. */
  preset: RockPresetKey | 'custom';
  /** Rocks per square centimetre of printed model where the ground suits them best. */
  rocksPerSquareCm: number;
  /** Smallest and largest rock across, on the printed model. */
  minimumSizeMm: number;
  maximumSizeMm: number;
  /** 0 keeps rocks rounded; 1 cuts them into sharp, faceted blocks. */
  angularity: number;
  /** 0 keeps rocks chunky; 1 squashes them into slabs. */
  flattening: number;
  /** 0 keeps rocks even; 1 stretches them into long blocks. */
  elongation: number;
  /** 0 scatters rocks evenly; 1 gathers boulder fields with stones strewn between. */
  clustering: number;
  /** 0 rests rocks on the ground; 1 sinks them up to most of their height. */
  embedding: number;
  /** 0 ignores the ground; 1 favours steep slopes, where scree and outcrops gather. */
  slopePreference: number;
  baseColor: string;
  /** Lichen or weathering on upward faces. */
  accentColor: string;
  /** Per-rock brightness jitter, 0 to 1. */
  colorVariation: number;
}
