export interface TerrainConfiguration {
  featureScale: number;
  noiseOctaves: readonly { frequency: number; amplitude: number }[];
  sampleSpacing: number;
  overscan: number;
  maxSamples: number;
}

export interface EngineConfiguration extends Pick<
  TerrainConfiguration,
  'sampleSpacing' | 'overscan' | 'maxSamples'
> {
  elevationMin: number;
  elevationMax: number;
  resizeDebounceMs: number;
  cursorMaxFps: number;
}

export interface HeightField {
  columns: number;
  rows: number;
  originX: number;
  originY: number;
  spacing: number;
  values: Float64Array;
}

/** How much real-terrain source data and sampling density a render requests. */
export type TerrainDetail = 'standard' | 'high' | 'max';
