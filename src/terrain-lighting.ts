export interface TerrainLightingSettings {
  mode: 'sun' | 'moon' | 'off';
  direction: number;
  elevation: number;
  intensity: number;
  fill: number;
}

/** Session-only lighting starts with warm sunlight and soft fill to reveal the natural materials. */
export const defaultTerrainLighting: Readonly<TerrainLightingSettings> = Object.freeze({
  mode: 'sun',
  direction: 315,
  elevation: 35,
  intensity: 2.5,
  fill: 0.7,
});

export const terrainLightingControls = [
  { key: 'direction', label: 'Direction', min: 0, max: 360, step: 5, suffix: '°' },
  { key: 'elevation', label: 'Elevation', min: 0, max: 90, step: 1, suffix: '°' },
  { key: 'intensity', label: 'Intensity', min: 0, max: 5, step: 0.1, suffix: '' },
  { key: 'fill', label: 'Fill', min: 0, max: 3, step: 0.1, suffix: '' },
] as const;

/** An artistic sunrise-side suggestion, not a solar-position calculation. Bearings are clockwise from north. */
export function getSuggestedTerrainLightDirection(latitude?: number): number {
  if (latitude === undefined || !Number.isFinite(latitude)) {
    return defaultTerrainLighting.direction;
  }

  if (Math.abs(latitude) < 5) {
    return 90;
  }

  return latitude > 0 ? 120 : 60;
}
