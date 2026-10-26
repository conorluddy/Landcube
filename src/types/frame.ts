import type { TerrainSurfaceBuffers } from '../terrain-surface';

export type FrameProfilePreset = 'square' | 'chamfer' | 'cove' | 'stepped' | 'floating';
export type FrameOutlineShape = 'match' | 'square' | 'circle';
export type FramePrintOrientation = 'upright' | 'face-down';
export type FramePartId = 'frame' | 'back' | 'mount-1' | 'mount-2' | 'riser';

/** Mount and float geometry settles in #36; the tray rejects both until then. */
export interface FrameMount {
  widthMm: number;
  thicknessMm: number;
}

export interface FrameFloat {
  insetMm: number;
  liftMm: number;
}

export interface TrayFrameSettings {
  style: 'tray';
  outline: FrameOutlineShape;
  profile: FrameProfilePreset;
  borderWidthMm: number;
  /** Measured from the floor top, where the model sits. */
  wallHeightMm: number;
  floorThicknessMm: number;
  clearanceMm: number;
  mounts: readonly FrameMount[];
  float?: FrameFloat;
}

export type FrameSettings = { style: 'none' } | TrayFrameSettings;

export interface FramePart {
  id: FramePartId;
  solid: TerrainSurfaceBuffers;
  printOrientation: FramePrintOrientation;
}

export interface FrameWarning {
  code: 'exceeds-bed';
  partId: FramePartId;
  message: string;
}

export interface FrameAssembly {
  parts: readonly FramePart[];
  outerSizeMm: { x: number; y: number; z: number };
  warnings: readonly FrameWarning[];
}

/** The model's outline on the bed, centred on the origin in the XZ plane. */
export type FrameFootprint =
  | { shape: 'rectangle'; halfWidthMm: number; halfLengthMm: number }
  | { shape: 'circle'; radiusMm: number };

/** A cross-section point measured outward from the footprint edge and up from the bed. */
export interface FrameProfilePoint {
  offsetMm: number;
  heightMm: number;
}

/**
 * An open, counter-clockwise polyline in [offsetMm, heightMm]. The sweep closes it with
 * flat caps to the centre: a downward cap at the first point, an upward cap at the last.
 */
export interface FrameProfile {
  points: readonly FrameProfilePoint[];
  printOrientation: FramePrintOrientation;
}
