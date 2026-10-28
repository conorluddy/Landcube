import { realTerrainPresets } from './constants/real-terrain';
import type { RealTerrain } from './real-terrain';

/** Geographic edges of the printed model, in decimal degrees. */
export interface GeoBounds {
  north: number;
  south: number;
  west: number;
  east: number;
}

/** Where the cropped model sits on Earth; names come from presets and are never shared in links. */
export interface FloorPlace {
  name?: string;
  region?: string;
  latitude: number;
  longitude: number;
  /** North-aligned extent of the floor sheet; wider than the model when the crop is rotated. */
  widthKm: number;
  lengthKm: number;
  bounds: GeoBounds;
  /** Clockwise turn of the model from north; floor overlays turn back by this to point north. */
  rotationRadians?: number;
  /** The model's own size, present only when it differs from the floor sheet. */
  modelSizeKm?: { widthKm: number; lengthKm: number };
}

const kilometersPerDegreeLatitude = 111.32;

/** Locates a crop of a square real-terrain source; undefined without a location or a usable span. */
export function createFloorPlace(
  source: Pick<RealTerrain, 'location' | 'spanKm'> | undefined,
  crop: { x: number; y: number; width: number; height: number; rotationRadians?: number },
  frame: { width: number; height: number },
  isRound = false,
): FloorPlace | undefined {
  const location = source?.location;
  const spanKm = source?.spanKm;

  if (location === undefined || spanKm === undefined) {
    return undefined;
  }

  // Zero or non-finite sizes would divide by zero in the bounds and scale-bar math.
  if (![spanKm, crop.width, crop.height, frame.width, frame.height].every(isPositiveFinite)) {
    return undefined;
  }

  const kilometersPerUnit = spanKm / Math.max(frame.width, frame.height);
  const offsetEastKm = (crop.x + crop.width / 2 - frame.width / 2) * kilometersPerUnit;
  const offsetSouthKm = (crop.y + crop.height / 2 - frame.height / 2) * kilometersPerUnit;
  const modelWidthKm = crop.width * kilometersPerUnit;
  const modelLengthKm = crop.height * kilometersPerUnit;
  const rotationRadians = crop.rotationRadians ?? 0;
  // A disc covers the same ground at any angle; boxes need their north-aligned bounding box.
  const cos = isRound ? 1 : Math.abs(Math.cos(rotationRadians));
  const sin = isRound ? 0 : Math.abs(Math.sin(rotationRadians));
  const widthKm = modelWidthKm * cos + modelLengthKm * sin;
  const lengthKm = modelWidthKm * sin + modelLengthKm * cos;
  const latitude = location.latitude - offsetSouthKm / kilometersPerDegreeLatitude;
  const longitude = location.longitude + offsetEastKm / kilometersPerDegreeLongitude(latitude);
  const preset = realTerrainPresets.find(
    (candidate) =>
      Math.abs(candidate.latitude - location.latitude) < 1e-4 &&
      Math.abs(candidate.longitude - location.longitude) < 1e-4,
  );

  return {
    name: preset?.name,
    region: preset?.country,
    latitude,
    longitude,
    widthKm,
    lengthKm,
    bounds: boundsFromCenter(latitude, longitude, widthKm, lengthKm),
    ...(rotationRadians !== 0 ? { rotationRadians } : {}),
    ...(widthKm !== modelWidthKm || lengthKm !== modelLengthKm
      ? { modelSizeKm: { widthKm: modelWidthKm, lengthKm: modelLengthKm } }
      : {}),
  };
}

/** Approximate bounds; accurate to label precision across the 200 km maximum real-terrain span. */
export function boundsFromCenter(
  latitude: number,
  longitude: number,
  widthKm: number,
  lengthKm: number,
): GeoBounds {
  const halfLatitude = lengthKm / 2 / kilometersPerDegreeLatitude;
  const halfLongitude = widthKm / 2 / kilometersPerDegreeLongitude(latitude);

  return {
    north: latitude + halfLatitude,
    south: latitude - halfLatitude,
    west: longitude - halfLongitude,
    east: longitude + halfLongitude,
  };
}

/** 32.8842, 'lat' → "32°53′03″N"; with `minutes` precision → "32°53′N". */
export function formatDms(
  value: number,
  axis: 'lat' | 'lon',
  precision: 'seconds' | 'minutes' = 'seconds',
): string {
  const wrapped = axis === 'lon' ? wrapLongitude(value) : value;
  const absolute = Math.abs(wrapped);
  const totalSeconds =
    precision === 'minutes' ? Math.round(absolute * 60) * 60 : Math.round(absolute * 3600);
  const degrees = Math.floor(totalSeconds / 3600);
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  const hemisphere = getHemisphere(wrapped, axis);

  return precision === 'minutes'
    ? `${degrees}°${minutes}′${hemisphere}`
    : `${degrees}°${minutes}′${seconds}″${hemisphere}`;
}

/** 32.8842, 'lat' → "32.8842°N". */
export function formatDecimal(value: number, axis: 'lat' | 'lon', digits = 4): string {
  const wrapped = axis === 'lon' ? wrapLongitude(value) : value;

  return `${Math.abs(wrapped).toFixed(digits)}°${getHemisphere(wrapped, axis)}`;
}

/** Smallest label-friendly step giving at most `targetLines` lines across `rangeDegrees`. */
export function pickGraticuleStep(rangeDegrees: number, targetLines = 4): number {
  return graticuleStepsDegrees.find((step) => rangeDegrees / step <= targetLines + 0.5) ?? 10;
}

/** Graticule values strictly inside (min, max), rounded to whole seconds to avoid float drift. */
export function graticuleValues(min: number, max: number, step: number): number[] {
  const values: number[] = [];
  const first = Math.ceil(min / step + 1e-9) * step;

  for (let value = first; value < max - 1e-9; value += step) {
    values.push(Math.round(value * 3600) / 3600);
  }

  return values;
}

/** Position of a latitude within the model: 0 at the north edge, 1 at the south edge. */
export function latitudeFraction(bounds: GeoBounds, latitude: number): number {
  return (bounds.north - latitude) / (bounds.north - bounds.south);
}

/** Position of a longitude within the model: 0 at the west edge, 1 at the east edge. */
export function longitudeFraction(bounds: GeoBounds, longitude: number): number {
  return (longitude - bounds.west) / (bounds.east - bounds.west);
}

/** 1/2/5 distance closest to `targetKm` without exceeding `maxKm`. */
export function pickScaleDistanceKm(targetKm: number, maxKm = Infinity): number {
  const magnitude = 10 ** Math.floor(Math.log10(targetKm));
  const candidates = [1, 2, 5, 10]
    .map((factor) => factor * magnitude)
    .filter((distance) => distance <= maxKm);

  return candidates.reduce(
    (best, distance) =>
      Math.abs(distance - targetKm) < Math.abs(best - targetKm) ? distance : best,
    candidates[0] ?? magnitude,
  );
}

/** Graticule lines inside the model, at most five per axis. */
export function getPlaceGraticule(place: FloorPlace): {
  latitudes: number[];
  longitudes: number[];
} {
  const { bounds } = place;
  const step = pickGraticuleStep(
    Math.max(bounds.north - bounds.south, bounds.east - bounds.west),
    5,
  );

  return {
    latitudes: graticuleValues(bounds.south, bounds.north, step),
    longitudes: graticuleValues(bounds.west, bounds.east, step),
  };
}

/** "32.8842°N 131.1040°E". */
export function formatDecimalPair(place: FloorPlace): string {
  return `${formatDecimal(place.latitude, 'lat')} ${formatDecimal(place.longitude, 'lon')}`;
}

/** "25 × 12.5 km". */
export function formatModelSize(place: FloorPlace): string {
  const { widthKm, lengthKm } = place.modelSizeKm ?? place;

  return `${formatKm(widthKm)} × ${formatKm(lengthKm)} km`;
}

/** Square and circular models print one distance: "25 KM". */
export function formatModelSpan(place: FloorPlace): string {
  const { widthKm, lengthKm } = place.modelSizeKm ?? place;

  return widthKm === lengthKm ? `${formatKm(widthKm)} KM` : formatModelSize(place).toUpperCase();
}

// === HELPERS ===

/** Arc-minute steps that read well as labels, in degrees. */
const graticuleStepsDegrees = [1, 2, 3, 5, 10, 15, 20, 30, 60, 120, 300, 600].map(
  (minutes) => minutes / 60,
);

function kilometersPerDegreeLongitude(latitude: number): number {
  return kilometersPerDegreeLatitude * Math.cos((latitude * Math.PI) / 180);
}

function wrapLongitude(longitude: number): number {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}

function getHemisphere(value: number, axis: 'lat' | 'lon'): string {
  if (axis === 'lat') {
    return value >= 0 ? 'N' : 'S';
  }

  return value >= 0 ? 'E' : 'W';
}

function formatKm(km: number): number {
  return Number(km.toPrecision(3));
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
