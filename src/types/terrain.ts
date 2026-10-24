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
