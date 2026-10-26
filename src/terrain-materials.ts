/** Session-only finishes for the physical model preview. */
export const landFinishes = {
  matte: { label: 'Matte', roughness: 1, clearcoat: 0 },
  satin: { label: 'Satin', roughness: 0.55, clearcoat: 0.15 },
  natural: { label: 'Natural', roughness: 0.96, clearcoat: 0 },
};

export const waterFinishes = {
  graphic: { label: 'Graphic', roughness: 1, clearcoat: 0 },
  satin: { label: 'Satin', roughness: 0.45, clearcoat: 0.2 },
  translucent: { label: 'Translucent resin', roughness: 0.16, clearcoat: 1 },
  glossy: { label: 'Glossy resin', roughness: 0.16, clearcoat: 1 },
};

export type LandFinish = keyof typeof landFinishes;
export type WaterFinish = keyof typeof waterFinishes;

export const terrainMaterialPresets = {
  natural: {
    label: 'Natural landscape',
    land: '#ffffff',
    water: '#36666b',
    landFinish: 'natural',
    waterFinish: 'satin',
  },
  porcelain: {
    label: 'Porcelain',
    land: '#e9e2d3',
    water: '#165b62',
    landFinish: 'satin',
    waterFinish: 'glossy',
  },
  plaster: {
    label: 'Plaster',
    land: '#eeeae2',
    water: '#728b98',
    landFinish: 'matte',
    waterFinish: 'satin',
  },
  terracotta: {
    label: 'Terracotta',
    land: '#b96b4e',
    water: '#174c57',
    landFinish: 'matte',
    waterFinish: 'glossy',
  },
  slate: {
    label: 'Slate',
    land: '#42494e',
    water: '#172b36',
    landFinish: 'matte',
    waterFinish: 'glossy',
  },
} satisfies Record<
  string,
  {
    label: string;
    land: string;
    water: string;
    landFinish: LandFinish;
    waterFinish: WaterFinish;
  }
>;
