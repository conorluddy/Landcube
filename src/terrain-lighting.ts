export interface TerrainLightingSettings {
  /** Hours from midnight, 0–24; drives sun height, colour and the studio tint. */
  timeOfDay: number;
  /** Key light off: fill only, no cast shadows. */
  flat: boolean;
  direction: number;
  intensity: number;
  fill: number;
  /** 0–1 atmospheric perspective fading distant terrain into the backdrop. */
  haze: number;
}

export interface TerrainAtmosphere {
  label: string;
  sunElevation: number;
  sunColor: string;
  sunScale: number;
  fillScale: number;
  skyColor: string;
  groundColor: string;
  /** Multiplies the floor and backdrop so the studio darkens and cools at night. */
  tint: string;
}

/** Session-only lighting starts with warm morning sun and soft fill to reveal the natural materials. */
export const defaultTerrainLighting: Readonly<TerrainLightingSettings> = Object.freeze({
  timeOfDay: 9,
  flat: false,
  direction: 315,
  intensity: 2.5,
  fill: 0.7,
  haze: 0,
});

export const terrainLightingControls = [
  { key: 'direction', label: 'Direction', min: 0, max: 360, step: 5, suffix: '°' },
  { key: 'intensity', label: 'Intensity', min: 0, max: 5, step: 0.1, suffix: '' },
  { key: 'fill', label: 'Fill', min: 0, max: 3, step: 0.1, suffix: '' },
] as const;

const night = {
  label: 'Night',
  sunElevation: 45,
  sunColor: '#a9c7ff',
  sunScale: 0.45,
  fillScale: 0.3,
  skyColor: '#7d93c4',
  groundColor: '#1c1f2a',
  tint: '#3d4866',
};
const blueHour = {
  label: 'Blue hour',
  sunElevation: 6,
  sunColor: '#9fb4ec',
  sunScale: 0.3,
  fillScale: 0.6,
  skyColor: '#a9b9e6',
  groundColor: '#2b2e3d',
  tint: '#8593bd',
};
const goldenHour = {
  label: 'Golden hour',
  sunElevation: 10,
  sunColor: '#ffb36b',
  sunScale: 1.3,
  fillScale: 0.7,
  skyColor: '#ffd6b0',
  groundColor: '#4a3a2c',
  tint: '#f2d2b0',
};
// Matches the original fixed sun so the default view is unchanged.
const morning = {
  label: 'Morning',
  sunElevation: 35,
  sunColor: '#ffd09a',
  sunScale: 1,
  fillScale: 1,
  skyColor: '#e8f0ff',
  groundColor: '#36382c',
  tint: '#ffffff',
};

/** An artistic day, not a solar model; hours ascend and wrap at 24. */
export const timeOfDayKeyframes: readonly (TerrainAtmosphere & { hour: number })[] = [
  { hour: 0, ...night },
  { hour: 4.5, ...night },
  { hour: 5.5, ...blueHour },
  { hour: 7, ...goldenHour },
  { hour: 9, ...morning },
  {
    hour: 13,
    label: 'Midday',
    sunElevation: 65,
    sunColor: '#fff4df',
    sunScale: 1.1,
    fillScale: 1.1,
    skyColor: '#eef4ff',
    groundColor: '#3a3c30',
    tint: '#ffffff',
  },
  { hour: 16, ...morning, label: 'Afternoon' },
  { hour: 18.5, ...goldenHour },
  { hour: 20, ...blueHour },
  { hour: 21.5, ...night },
];

// === PUBLIC API ===

/** Interpolates the keyframes around `timeOfDay`; the label comes from the nearest one. */
export function getTerrainAtmosphere(timeOfDay: number): TerrainAtmosphere {
  const hour = ((timeOfDay % 24) + 24) % 24;
  const nextIndex = timeOfDayKeyframes.findIndex((keyframe) => keyframe.hour > hour);
  // The first keyframe sits at midnight, so a later keyframe or the wrap always exists.
  const previous =
    timeOfDayKeyframes[(nextIndex === -1 ? timeOfDayKeyframes.length : nextIndex) - 1];
  const next =
    nextIndex === -1 ? { ...timeOfDayKeyframes[0], hour: 24 } : timeOfDayKeyframes[nextIndex];
  const t = (hour - previous.hour) / (next.hour - previous.hour);

  return {
    label: t < 0.5 ? previous.label : next.label,
    sunElevation: lerp(previous.sunElevation, next.sunElevation, t),
    sunColor: mixHexColors(previous.sunColor, next.sunColor, t),
    sunScale: lerp(previous.sunScale, next.sunScale, t),
    fillScale: lerp(previous.fillScale, next.fillScale, t),
    skyColor: mixHexColors(previous.skyColor, next.skyColor, t),
    groundColor: mixHexColors(previous.groundColor, next.groundColor, t),
    tint: mixHexColors(previous.tint, next.tint, t),
  };
}

/** "06:30 · Golden hour" */
export function formatTimeOfDay(timeOfDay: number): string {
  const totalMinutes = Math.round(timeOfDay * 60) % (24 * 60);
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const minutes = String(totalMinutes % 60).padStart(2, '0');

  return `${hours}:${minutes} · ${getTerrainAtmosphere(timeOfDay).label}`;
}

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

const daylightStartHour = 5;
const daylightHours = 16;
/** Share of each cycle spent between 05:00 and 21:00; night passes quickly. */
const daylightShare = 0.85;

/** Maps a 0–1 cycle phase to a time and a sun bearing that rises east and sets west. */
export function getDaylightCycleLighting(
  phase: number,
  latitude?: number,
): Pick<TerrainLightingSettings, 'timeOfDay' | 'direction'> {
  const wrapped = ((phase % 1) + 1) % 1;
  const timeOfDay =
    wrapped < daylightShare
      ? daylightStartHour + (daylightHours * wrapped) / daylightShare
      : (daylightStartHour +
          daylightHours +
          ((24 - daylightHours) * (wrapped - daylightShare)) / (1 - daylightShare)) %
        24;
  // Fifteen degrees per hour from noon: through south in the north, through north in the south.
  const hourAngle = (timeOfDay - 12) * 15;
  const bearing = (latitude ?? 0) < 0 ? 360 - hourAngle : 180 + hourAngle;

  return { timeOfDay, direction: ((bearing % 360) + 360) % 360 };
}

/** Starts a cycle where the current time already sits, so enabling it never jumps. */
export function getDaylightCyclePhase(timeOfDay: number): number {
  const daylightProgress = (timeOfDay - daylightStartHour) / daylightHours;

  return daylightProgress >= 0 && daylightProgress < 1 ? daylightProgress * daylightShare : 0;
}

// === HELPERS ===

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function mixHexColors(from: string, to: string, t: number): string {
  const channels = [1, 3, 5].map((offset) =>
    Math.round(
      lerp(
        Number.parseInt(from.slice(offset, offset + 2), 16),
        Number.parseInt(to.slice(offset, offset + 2), 16),
        t,
      ),
    ),
  );

  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}
