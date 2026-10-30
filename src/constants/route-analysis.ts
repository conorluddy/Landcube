/** Route analysis tuning (docs/PRD/terrain-measurement-and-routes.md, REQ-27/28, technical notes). */

export const defaultSlopeThresholdPercent = 15;
export const minimumSlopeThresholdPercent = 1;
export const maximumSlopeThresholdPercent = 100;

/** Profile sample target; inputs with this many original points or more are decimated to it. */
export const maximumRouteSamples = 10_000;
/** Spacing never finer than this, even over high-resolution sources. */
export const minimumSampleSpacingMeters = 10;
/** Grade window floor; the window also spans at least two sample intervals. */
export const minimumGradeWindowMeters = 50;
