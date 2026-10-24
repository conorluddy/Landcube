export const seededRandomIncrement = 0x6d2b79f5;
export const unsignedIntegerRange = 4294967296;
export const noisePermutationSize = 256;
export const noisePermutationMask = noisePermutationSize - 1;
export const noiseGradientCount = 16;
export const noiseGradients = Array.from({ length: noiseGradientCount }, (_, gradientIndex) => {
  const gradientAngleRadians = (gradientIndex * Math.PI) / (noiseGradientCount / 2);
  return [Math.cos(gradientAngleRadians), Math.sin(gradientAngleRadians)] as const;
});
export const terrainOffsetSeedMask = 0x9e3779b9;
export const terrainNoiseOffsetRange = 100;
export const terrainRotationRadians = 0.39;
export const detailNoiseOctaves = [
  { frequency: 2, amplitude: 0.75 },
  { frequency: 4, amplitude: 0.25 },
] as const;
