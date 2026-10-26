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
