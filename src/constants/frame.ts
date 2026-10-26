import type { FrameProfilePreset } from '../types/frame';

export const frameProfilePresets: readonly FrameProfilePreset[] = [
  'square',
  'chamfer',
  'cove',
  'stepped',
  'floating',
];

/** Three perimeters with a 0.4 mm nozzle. */
export const minimumFrameWallMm = 1.2;
/** Steepest overhang that prints without supports, measured from vertical. */
export const maximumFrameOverhangDegrees = 45;
export const maximumFrameDimensionMm = 1000;
/** Segments per quarter-circle in cove, round and ogee edges. */
export const frameEdgeArcSegments = 8;

/** The rim stands this far above the model's base. */
export const trayWallAboveBaseMm = 4;
export const defaultTrayBorderWidthMm = 10;
export const defaultTrayFloorThicknessMm = 2;
/** Assumed fit per side; confirm with a 60 mm test print (#33 OQ-1). */
export const defaultTrayClearanceMm = 0.3;
