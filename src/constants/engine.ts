import type { EngineConfiguration } from '../types/terrain';

/** Version-one engine constants; distances are CSS pixels. */
export const engineConfiguration: Readonly<EngineConfiguration> = Object.freeze({
  sampleSpacing: 5, overscan: 60, maxSamples: 450_000,
  elevationMin: -0.72, elevationMax: 0.72,
  resizeDebounceMs: 100, cursorMaxFps: 30,
});
