import { noiseGradientCount, noiseGradients, noisePermutationMask, noisePermutationSize, seededRandomIncrement, terrainNoiseOffsetRange, terrainOffsetSeedMask, terrainRotationRadians, unsignedIntegerRange } from './constants/terrain';
import type { HeightField, TerrainConfiguration } from './types/terrain';

/** Mulberry32: deterministic, local randomness; no noise-library dependency. */
export function createSeededRandomGenerator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    /** Advances the private generator state for the next deterministic sample. */
    state = (state + seededRandomIncrement) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / unsignedIntegerRange;
  };
}

/** Creates smooth gradient noise with a deterministic shuffled lattice. */
export function createSeededNoiseSampler(seed: number): (x: number, y: number) => number {
  const random = createSeededRandomGenerator(seed);
  const permutation = Array.from({ length: noisePermutationSize }, (_, index) => index);
  for (let permutationIndex = noisePermutationMask; permutationIndex > 0; permutationIndex--) {
    const shuffledIndex = Math.floor(random() * (permutationIndex + 1));
    [permutation[permutationIndex], permutation[shuffledIndex]] = [permutation[shuffledIndex], permutation[permutationIndex]];
  }
  const repeatedPermutation = [...permutation, ...permutation];
  /** Makes interpolation smooth at lattice boundaries. */
  const calculateFadeWeight = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  /** Blends neighboring gradient contributions. */
  const interpolateLinearly = (a: number, b: number, t: number) => a + t * (b - a);
  /** Projects a lattice gradient onto the sample offset. */
  const calculateGradientDotProduct = (hash: number, x: number, y: number) => {
    const gradient = noiseGradients[hash & (noiseGradientCount - 1)];
    return gradient[0] * x + gradient[1] * y;
  };
  return (x, y) => {
    /** Interpolates four lattice gradients at the requested noise coordinate. */
    const floorX = Math.floor(x);
    const floorY = Math.floor(y);
    const wrappedColumn = floorX & noisePermutationMask;
    const wrappedRow = floorY & noisePermutationMask;
    const fractionalX = x - floorX;
    const fractionalY = y - floorY;
    return Math.SQRT2 * interpolateLinearly(
      interpolateLinearly(calculateGradientDotProduct(repeatedPermutation[repeatedPermutation[wrappedColumn] + wrappedRow], fractionalX, fractionalY), calculateGradientDotProduct(repeatedPermutation[repeatedPermutation[wrappedColumn + 1] + wrappedRow], fractionalX - 1, fractionalY), calculateFadeWeight(fractionalX)),
      interpolateLinearly(calculateGradientDotProduct(repeatedPermutation[repeatedPermutation[wrappedColumn] + wrappedRow + 1], fractionalX, fractionalY - 1), calculateGradientDotProduct(repeatedPermutation[repeatedPermutation[wrappedColumn + 1] + wrappedRow + 1], fractionalX - 1, fractionalY - 1), calculateFadeWeight(fractionalX)),
      calculateFadeWeight(fractionalY),
    );
  };
}

/** Builds a stable world-space height sampler for one landscape seed. */
export function createTerrainSampler(seed: number, settings: Readonly<TerrainConfiguration>): (x: number, y: number) => number {
  const noise = createSeededNoiseSampler(seed);
  const random = createSeededRandomGenerator(seed ^ terrainOffsetSeedMask);
  const offsetX = random() * terrainNoiseOffsetRange;
  const offsetY = random() * terrainNoiseOffsetRange;
  const angle = terrainRotationRadians;
  return (x: number, y: number) => {
    /** Combines rotated octave samples into a continuous terrain height. */
    // Rotate the noise lattice and offset away from integer-lattice symmetry.
    const rotatedX = (x * Math.cos(angle) - y * Math.sin(angle)) / settings.featureScale;
    const rotatedY = (x * Math.sin(angle) + y * Math.cos(angle)) / settings.featureScale;
    return settings.noiseOctaves.reduce((height, octave) => height + octave.amplitude * noise(
      rotatedX * octave.frequency + offsetX,
      rotatedY * octave.frequency + offsetY,
    ), 0);
  };
}

/** Samples beyond the frame while keeping memory within the engine budget. */
export function sampleTerrain(
  terrain: (x: number, y: number) => number,
  width: number,
  height: number,
  settings: Readonly<TerrainConfiguration>,
): HeightField {
  let spacing: number = settings.sampleSpacing;
  /** Includes overscan at the current sampling resolution. */
  const calculateSampleDimensions = () => ({
    columns: Math.ceil((width + settings.overscan) / spacing) + Math.ceil(settings.overscan / spacing) + 1,
    rows: Math.ceil((height + settings.overscan) / spacing) + Math.ceil(settings.overscan / spacing) + 1,
  });
  let { columns, rows } = calculateSampleDimensions();
  while (columns * rows > settings.maxSamples) {
    spacing *= 2;
    ({ columns, rows } = calculateSampleDimensions());
  }
  const originX = -Math.ceil(settings.overscan / spacing) * spacing;
  const originY = originX;
  const values = new Float64Array(columns * rows);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      values[row * columns + column] = terrain(originX + column * spacing, originY + row * spacing);
    }
  }
  return { columns, rows, originX, originY, spacing, values };
}
