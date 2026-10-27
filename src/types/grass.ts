import type { grassPresets } from '../constants/grass';

export type GrassPresetKey = keyof typeof grassPresets;

/** Grass in the 3D preview; colour, length, density and wind never regrow its coverage. */
export interface GrassStyle {
  enabled: boolean;
  /** 'custom' once any colour or length setting is edited by hand. */
  preset: GrassPresetKey | 'custom';
  /** Blades per square centimetre of printed model where coverage is full. */
  bladesPerSquareCm: number;
  /** Share of the ground in grass patches, 0 to 1. */
  coverage: number;
  /** 0 spreads grass evenly; 1 gathers it into distinct clumps with bare ground between. */
  clumping: number;
  /** Typical blade length on the printed model. */
  lengthMm: number;
  /** How far individual blades stray from the typical length, 0 to 1. */
  lengthVariation: number;
  baseColor: string;
  tipColor: string;
  dryColor: string;
  /** Per-blade brightness jitter, 0 to 1. */
  colorVariation: number;
  /** Share of patches turned to dry grass, 0 to 1. */
  dryness: number;
  /** Real-world slope above which grass gives way to bare ground. */
  slopeLimitDegrees: number;
  /** Fraction of the model's relief above which grass thins out; 1 keeps it on the summits. */
  altitudeLimit: number;
  /** Tip sway strength, 0 for still grass; reduced motion always keeps it still. */
  wind: number;
}
