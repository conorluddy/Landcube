/** Colour and length looks; placement settings are left as the user set them. */
export const grassPresets = {
  meadow: {
    label: 'Meadow',
    baseColor: '#4f6b2a',
    tipColor: '#b1c25a',
    dryColor: '#c7b46a',
    colorVariation: 0.35,
    dryness: 0.15,
    lengthMm: 1.4,
    lengthVariation: 0.4,
  },
  lush: {
    label: 'Lush pasture',
    baseColor: '#24461a',
    tipColor: '#76b043',
    dryColor: '#9bb35a',
    colorVariation: 0.25,
    dryness: 0.05,
    lengthMm: 1.1,
    lengthVariation: 0.3,
  },
  moorland: {
    label: 'Moorland',
    baseColor: '#3f3b22',
    tipColor: '#a39252',
    dryColor: '#b98a5e',
    colorVariation: 0.45,
    dryness: 0.45,
    lengthMm: 1.8,
    lengthVariation: 0.55,
  },
  alpine: {
    label: 'Alpine',
    baseColor: '#34492c',
    tipColor: '#8ea65e',
    dryColor: '#b8ab7a',
    colorVariation: 0.3,
    dryness: 0.25,
    lengthMm: 0.8,
    lengthVariation: 0.35,
  },
  autumn: {
    label: 'Autumn',
    baseColor: '#4a3f1d',
    tipColor: '#cfa149',
    dryColor: '#a8592f',
    colorVariation: 0.5,
    dryness: 0.4,
    lengthMm: 1.5,
    lengthVariation: 0.45,
  },
} as const;

export const defaultGrassStyle = {
  enabled: false,
  preset: 'meadow',
  density: 160,
  coverage: 0.7,
  clumping: 0.5,
  slopeLimitDegrees: 35,
  altitudeLimit: 0.85,
  wind: 0.35,
  baseColor: grassPresets.meadow.baseColor,
  tipColor: grassPresets.meadow.tipColor,
  dryColor: grassPresets.meadow.dryColor,
  colorVariation: grassPresets.meadow.colorVariation,
  dryness: grassPresets.meadow.dryness,
  lengthMm: grassPresets.meadow.lengthMm,
  lengthVariation: grassPresets.meadow.lengthVariation,
} as const;

/** Generated landscapes have no real scale; treat them as 10 km across with 1,000 m of relief. */
export const generatedTerrainSpanMeters = 10_000;
export const generatedTerrainReliefMeters = 1_000;
