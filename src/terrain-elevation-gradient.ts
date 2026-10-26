import { mixOklch } from './color/oklch';

export interface ElevationColorStop {
  position: number;
  color: string;
}

export interface ElevationGradientSettings {
  enabled: boolean;
  transition: 'soft' | 'hard';
  stops: readonly ElevationColorStop[];
}

export const maximumElevationColorStops = 6;
export const elevationGradientPresets = {
  paper: {
    label: 'Paper & ink',
    stops: [
      { position: 0, color: '#111b24' },
      { position: 0.48, color: '#35434d' },
      { position: 0.72, color: '#bec5c7' },
      { position: 1, color: '#f5f3ec' },
    ],
  },
  sandstone: {
    label: 'Sandstone',
    stops: [
      { position: 0, color: '#493c33' },
      { position: 0.35, color: '#a47b56' },
      { position: 0.65, color: '#dfa764' },
      { position: 1, color: '#f3e8cf' },
    ],
  },
  ember: {
    label: 'Ember & slate',
    stops: [
      { position: 0, color: '#712d21' },
      { position: 0.3, color: '#d47032' },
      { position: 0.52, color: '#dfac75' },
      { position: 0.7, color: '#626568' },
      { position: 1, color: '#262d34' },
    ],
  },
  copper: {
    label: 'Copper & cream',
    stops: [
      { position: 0, color: '#39352f' },
      { position: 0.28, color: '#8e5135' },
      { position: 0.55, color: '#d99755' },
      { position: 0.8, color: '#e4ccaa' },
      { position: 1, color: '#f5eddc' },
    ],
  },
  coastal: {
    label: 'Coastal',
    stops: [
      { position: 0, color: '#20383e' },
      { position: 0.35, color: '#557e7b' },
      { position: 0.65, color: '#b0b8a1' },
      { position: 1, color: '#ece4cf' },
    ],
  },
} satisfies Record<string, { label: string; stops: ElevationColorStop[] }>;

/** Low-to-high land colours per biome; keys are stable IDs referenced by real-terrain presets. */
export const landscapeGradientPresets = {
  'landscape-temperate': {
    label: 'Temperate',
    stops: [
      { position: 0, color: '#3d5a3a' },
      { position: 0.35, color: '#6f8b4e' },
      { position: 0.65, color: '#a39b6a' },
      { position: 1, color: '#d9d3bd' },
    ],
  },
  'landscape-alpine': {
    label: 'Alpine',
    stops: [
      { position: 0, color: '#2f4a33' },
      { position: 0.3, color: '#5c6e4a' },
      { position: 0.55, color: '#7d7469' },
      { position: 0.78, color: '#a9a8a6' },
      { position: 1, color: '#f4f6f7' },
    ],
  },
  'landscape-arctic': {
    label: 'Arctic',
    stops: [
      { position: 0, color: '#3b4a52' },
      { position: 0.35, color: '#6f7d80' },
      { position: 0.65, color: '#b9c4c8' },
      { position: 1, color: '#f6f9fa' },
    ],
  },
  'landscape-coastal': {
    label: 'Coastal',
    stops: [
      { position: 0, color: '#d8c9a3' },
      { position: 0.2, color: '#7c8f5c' },
      { position: 0.6, color: '#4f6b43' },
      { position: 1, color: '#8a8670' },
    ],
  },
  'landscape-volcanic': {
    label: 'Volcanic',
    stops: [
      { position: 0, color: '#4b5b36' },
      { position: 0.35, color: '#5a4a3f' },
      { position: 0.65, color: '#3a3330' },
      { position: 0.85, color: '#7a3b2a' },
      { position: 1, color: '#c8c2b8' },
    ],
  },
  'landscape-canyon': {
    label: 'Canyon',
    stops: [
      { position: 0, color: '#6b3a24' },
      { position: 0.3, color: '#a5532e' },
      { position: 0.6, color: '#c98a52' },
      { position: 1, color: '#e6cfa4' },
    ],
  },
  'landscape-sandy': {
    label: 'Sandy',
    stops: [
      { position: 0, color: '#b9874f' },
      { position: 0.4, color: '#d8a865' },
      { position: 0.75, color: '#e8c48a' },
      { position: 1, color: '#f4e3bf' },
    ],
  },
  'landscape-rainforest': {
    label: 'Rainforest',
    stops: [
      { position: 0, color: '#1f3b24' },
      { position: 0.35, color: '#2f5a2e' },
      { position: 0.7, color: '#4f7a3a' },
      { position: 1, color: '#8fa36a' },
    ],
  },
  'landscape-steppe': {
    label: 'Steppe',
    stops: [
      { position: 0, color: '#6e7044' },
      { position: 0.4, color: '#a39a5e' },
      { position: 0.75, color: '#c2ae7a' },
      { position: 1, color: '#e0d3ad' },
    ],
  },
  'landscape-mediterranean': {
    label: 'Mediterranean',
    stops: [
      { position: 0, color: '#d9c7a0' },
      { position: 0.3, color: '#8f8a52' },
      { position: 0.65, color: '#5f6a3f' },
      { position: 1, color: '#b5a68a' },
    ],
  },
} satisfies Record<`landscape-${string}`, { label: string; stops: ElevationColorStop[] }>;

export type LandscapeGradientKey = keyof typeof landscapeGradientPresets;
export type LandscapeType = LandscapeGradientKey extends `landscape-${infer Type}` ? Type : never;

export function getLandscapeGradientKey(landscape: LandscapeType): LandscapeGradientKey {
  return `landscape-${landscape}`;
}

/** Blends stop-for-stop in OKLCH; both gradients are first resampled at shared positions. */
export function interpolateElevationGradient(
  from: ElevationGradientSettings,
  to: ElevationGradientSettings,
  fraction: number,
): ElevationGradientSettings {
  const union = [...new Set([...from.stops, ...to.stops].map((stop) => stop.position))].sort(
    (a, b) => a - b,
  );
  const positions =
    union.length > maximumElevationColorStops
      ? Array.from(
          { length: maximumElevationColorStops },
          (_, i) => i / (maximumElevationColorStops - 1),
        )
      : union;
  const fromStops = resampleElevationGradient(from.stops, positions);
  const toStops = resampleElevationGradient(to.stops, positions);

  return {
    ...to,
    stops: positions.map((position, i) => ({
      position,
      color: mixOklch(fromStops[i].color, toStops[i].color, fraction),
    })),
  };
}

/** Samples a soft gradient's colour at each position, mixing neighbours in linear light. */
export function resampleElevationGradient(
  stops: readonly ElevationColorStop[],
  positions: readonly number[],
): ElevationColorStop[] {
  return positions.map((position) => {
    const upperIndex = stops.findIndex((stop) => stop.position >= position);
    const upper = stops[upperIndex];

    if (upperIndex <= 0 || upper.position === position) {
      return { position, color: upper.color };
    }

    const lower = stops[upperIndex - 1];
    const fraction = (position - lower.position) / (upper.position - lower.position);

    return { position, color: mixElevationColors(lower.color, upper.color, fraction) };
  });
}

export function copyElevationGradient(
  settings: ElevationGradientSettings,
): ElevationGradientSettings {
  return { ...settings, stops: settings.stops.map((stop) => ({ ...stop })) };
}

export function validateElevationGradient(settings: ElevationGradientSettings): void {
  if (
    !['soft', 'hard'].includes(settings.transition) ||
    settings.stops.length < 2 ||
    settings.stops.length > maximumElevationColorStops
  ) {
    throw new Error('Choose Hard or Soft transitions and two to six gradient stops.');
  }

  for (let i = 0; i < settings.stops.length; i++) {
    const stop = settings.stops[i];

    if (
      !/^#[0-9a-f]{6}$/i.test(stop.color) ||
      !Number.isFinite(stop.position) ||
      stop.position < 0 ||
      stop.position > 1 ||
      (i > 0 && stop.position <= settings.stops[i - 1].position)
    ) {
      throw new Error('Gradient stops need valid colors and increasing positions from 0 to 100%.');
    }
  }

  if (settings.stops[0].position !== 0 || settings.stops.at(-1)?.position !== 1) {
    throw new Error('The first and last gradient stops must stay at 0% and 100%.');
  }
}

/** Hard bands meet halfway between color anchors; every stop has a visible elevation band. */
export function getElevationGradientCss(settings: ElevationGradientSettings): string {
  validateElevationGradient(settings);
  const stops = settings.stops.flatMap((stop, i) => {
    if (settings.transition === 'soft') {
      return [`${stop.color} ${stop.position * 100}%`];
    }

    const left = i === 0 ? 0 : (settings.stops[i - 1].position + stop.position) * 50;
    const right =
      i === settings.stops.length - 1 ? 100 : (stop.position + settings.stops[i + 1].position) * 50;

    return [`${stop.color} ${left}%`, `${stop.color} ${right}%`];
  });

  return `linear-gradient(90deg in srgb-linear, ${stops.join(', ')})`;
}

/** Inserts a new anchor without darkening the existing linear-light gradient. */
export function mixElevationColors(first: string, second: string, fraction: number): string {
  const channel = (color: string, offset: number) => {
    const value = parseInt(color.slice(offset, offset + 2), 16) / 255;

    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };

  const channels = [1, 3, 5].map((offset) => {
    const a = channel(first, offset);
    const value = a + (channel(second, offset) - a) * fraction;
    const srgb = value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;

    return Math.round(srgb * 255)
      .toString(16)
      .padStart(2, '0');
  });

  return `#${channels.join('')}`;
}
