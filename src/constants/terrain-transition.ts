/** Location changes reshape the 3D terrain over a fixed, camera-still timeline. */
export const terrainTransitionDurationMs = 2000;
/** The mesh holds still at both ends so outgoing and incoming decorations fade over settled terrain. */
export const terrainMorphStartFraction = 0.1;
export const terrainMorphEndFraction = 0.9;
export const terrainDecorationFadeFraction = 0.15;
