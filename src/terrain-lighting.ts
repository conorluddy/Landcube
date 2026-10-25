export interface TerrainLightingSettings {
  direction: number;
  elevation: number;
  intensity: number;
  fill: number;
}

/** Session-only lighting starts with the existing soft light from the upper left. */
export const defaultTerrainLighting: Readonly<TerrainLightingSettings> = Object.freeze({
  direction: 315,
  elevation: 55,
  intensity: 2.5,
  fill: 1.6,
});

export const terrainLightingControls = [
  { key: 'direction', label: 'Direction', min: 0, max: 360, step: 5, suffix: '°' },
  { key: 'elevation', label: 'Elevation', min: 0, max: 90, step: 1, suffix: '°' },
  { key: 'intensity', label: 'Intensity', min: 0, max: 5, step: 0.1, suffix: '' },
  { key: 'fill', label: 'Fill', min: 0, max: 3, step: 0.1, suffix: '' },
] as const;
