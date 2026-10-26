import {
  terrainDecorationFadeFraction,
  terrainMorphEndFraction,
  terrainMorphStartFraction,
} from './constants/terrain-transition';

/** One explicit-time sample of a terrain morph; the same elapsed time always yields the same frame. */
export interface TerrainTransitionFrame {
  /** Eased 0→1 across the morph window, without overshoot. */
  terrainProgress: number;
  /** Previous contours fade 1→0 over the opening fraction. */
  outgoingOpacity: number;
  /** Destination contours, engraving and water fade 0→1 over the closing fraction. */
  incomingOpacity: number;
  isComplete: boolean;
}

// === PUBLIC API ===

export function evaluateTerrainTransition(
  elapsedMs: number,
  durationMs: number,
): TerrainTransitionFrame {
  if (!(durationMs > 0) || Number.isNaN(elapsedMs)) {
    throw new Error(
      `Terrain transition needs a positive duration and a numeric elapsed time; received ${durationMs} ms and ${elapsedMs} ms.`,
    );
  }

  const time = clampUnit(elapsedMs / durationMs);
  const morphTime = clampUnit(
    (time - terrainMorphStartFraction) / (terrainMorphEndFraction - terrainMorphStartFraction),
  );

  return {
    terrainProgress: easeInOutCubic(morphTime),
    outgoingOpacity: 1 - clampUnit(time / terrainDecorationFadeFraction),
    incomingOpacity: clampUnit(
      (time - (1 - terrainDecorationFadeFraction)) / terrainDecorationFadeFraction,
    ),
    isComplete: time === 1,
  };
}

/** Writes (1 − t)·a + t·b so t = 1 reproduces the destination exactly. */
export function interpolateTerrainValues(
  source: ArrayLike<number>,
  destination: ArrayLike<number>,
  progress: number,
  output: Float32Array,
): void {
  if (source.length !== destination.length || output.length !== destination.length) {
    throw new Error(
      `Terrain morph buffers must match: source ${source.length}, destination ${destination.length}, output ${output.length}. Rebuild without a transition.`,
    );
  }

  for (let index = 0; index < output.length; index++) {
    output[index] = (1 - progress) * source[index] + progress * destination[index];
  }
}

// === HELPERS ===

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function easeInOutCubic(time: number): number {
  return time < 0.5 ? 4 * time ** 3 : 1 - (2 - 2 * time) ** 3 / 2;
}
