import type { TerrainSurfaceBuffers } from '../terrain-surface';

export type FrameProfilePreset = 'square' | 'chamfer' | 'cove' | 'stepped' | 'floating';
export type FrameOutlineShape = 'match' | 'square' | 'circle';
export type FramePrintOrientation = 'upright' | 'face-down';
/** `frame` is the bottom part; each separate tier above it starts `frame-<n>`. */
export type FramePartId = 'frame' | `frame-${number}` | 'back' | 'mount-1' | 'mount-2' | 'riser';

export type FrameEdgeShape = 'chamfer' | 'cove' | 'round' | 'ogee' | 'step';
/** The shape cut into a top corner. `sizeMm` is both its horizontal and vertical span. */
export type FrameEdge = { shape: 'square' } | { shape: FrameEdgeShape; sizeMm: number };
/** The shape cut into a part's bottom outer corner; an undercut toe casts a shadow line. */
export type FrameFootEdge = { shape: 'square' } | { shape: 'undercut'; sizeMm: number };

/** One horizontal band under the model. Tiers stack bottom-up. */
export interface FrameTier {
  /** Outer edge, measured outward from the model's footprint edge. */
  offsetMm: number;
  heightMm: number;
  edge: FrameEdge;
  /** Only a tier that starts a part has a foot; square when omitted. */
  footEdge?: FrameFootEdge;
  /** `join-below` merges with the tier underneath into one printed part. */
  part: 'join-below' | 'separate';
}

/** Measured from the floor top, where the model sits. `floor` is an absolute height. */
export type FrameRimHeight =
  | { reference: 'model-base'; aboveMm: number }
  | { reference: 'model-top'; belowMm: number }
  | { reference: 'floor'; heightMm: number };

/** The wall around the model's sides. It always joins the top tier. */
export interface FrameSurround {
  borderWidthMm: number;
  rimHeight: FrameRimHeight;
  rimEdge: FrameEdge;
  innerEdge: FrameEdge;
  /** Shadow-box lip over the model (#36); rejected until then. */
  lipMm?: number;
}

/** Mount geometry settles in #36; assembly rejects mounts until then. */
export interface FrameMount {
  widthMm: number;
  thicknessMm: number;
}

/** Only `table` builds today: `wall` waits on #36, `wall-perpendicular` on #52. */
export type FrameDisplay = 'table' | 'wall' | 'standing' | 'wall-perpendicular';

/** The frame hangs flat on the wall and the terrain base slots in at 90° (#52). */
export interface FrameWallMount {
  wallEdge: 'north' | 'east' | 'south' | 'west';
  backplate: 'picture-frame' | 'plain-plate' | 'open-frame';
}

/** No tiers and no surround means no frame. */
export interface FrameSettings {
  outline: FrameOutlineShape;
  clearanceMm: number;
  tiers: readonly FrameTier[];
  surround?: FrameSurround;
  mounts: readonly FrameMount[];
  display: FrameDisplay;
  wallMount?: FrameWallMount;
}

export interface FramePart {
  id: FramePartId;
  solid: TerrainSurfaceBuffers;
  printOrientation: FramePrintOrientation;
  /** Bounding box in Y-up model space: x width, y height, z length. */
  sizeMm: { x: number; y: number; z: number };
}

export interface FrameWarning {
  code: 'exceeds-bed';
  partId: FramePartId;
  message: string;
}

export interface FrameAssembly {
  parts: readonly FramePart[];
  outerSizeMm: { x: number; y: number; z: number };
  /** Where the model's base rests: the top of the tier stack. */
  seatHeightMm: number;
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
