import { getTerrainCropBounds, type TerrainCropSettings } from '../terrain-crop';
import type { CropFrameHandle } from '../ui/overlays/crop-frame';
import type { MapLocation } from './hud-store';

/**
 * Pure math for the on-canvas tools (#102): crop frame handles that resize `model.crop` with the
 * crop widget's clamps, the keyboard nudge, and measure distance and bearing between two places.
 */
export type CropHandle = CropFrameHandle;

/** A delta in fractions of the source frame: +x east, +y south. */
export interface FractionDelta {
  x: number;
  y: number;
}

export interface CropFrameSource {
  width: number;
  height: number;
  /** Crop width over height: model width/length, or 1 for a circle. */
  aspectRatio: number;
}

/** The crop's box as fractions of the source frame. */
export interface CropFractionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The crop widget's own floor: a crop never shrinks below a tenth of the largest that fits. */
const minimumCropSize = 0.1;
const nudgeFraction = 0.01;
const shiftNudgeFraction = 0.05;
const earthRadiusMeters = 6_371_008.8;

// === PUBLIC API ===

/** Where the crop sits on its source, normalised exactly as the crop widget normalises it. */
export function getCropFractionBox(
  crop: TerrainCropSettings,
  source: CropFrameSource,
): CropFractionBox {
  const box = getTerrainCropBounds(source.width, source.height, source.aspectRatio, crop);

  return {
    x: box.x / source.width,
    y: box.y / source.height,
    width: box.width / source.width,
    height: box.height / source.height,
  };
}

/**
 * Resizes the crop from one handle, keeping the opposite edge (or the centre, on the axis the
 * handle ignores) fixed. The aspect ratio is the model's, so a corner follows whichever axis asks
 * for more. Size stays between the widget's 10% and the room left on the source.
 */
export function resizeCrop(
  crop: TerrainCropSettings,
  handle: CropHandle,
  delta: FractionDelta,
  source: CropFrameSource,
): TerrainCropSettings {
  const { width, height, aspectRatio } = source;
  const box = getTerrainCropBounds(width, height, aspectRatio, crop);
  const full = getTerrainCropBounds(width, height, aspectRatio, { ...crop, size: 1 });
  const [directionX, directionY] = getHandleDirection(handle);
  const requestedSizes = [
    directionX === 0 ? 0 : (box.width + directionX * delta.x * width) / full.width,
    directionY === 0 ? 0 : (box.height + directionY * delta.y * height) / full.height,
  ];
  const roomX = getRoom(directionX, box.x, box.width, width) / full.width;
  const roomY = getRoom(directionY, box.y, box.height, height) / full.height;
  const size = clamp(Math.max(...requestedSizes), minimumCropSize, Math.min(1, roomX, roomY));

  return getTerrainCropBounds(width, height, aspectRatio, {
    size,
    centerX: anchorCenter(directionX, box.x, box.width, full.width * size) / width,
    centerY: anchorCenter(directionY, box.y, box.height, full.height * size) / height,
  }).crop;
}

/** Arrow keys nudge a handle 1% of the source, 5% with Shift; other keys return undefined. */
export function getNudgeDelta(key: string, isShiftPressed: boolean): FractionDelta | undefined {
  const step = isShiftPressed ? shiftNudgeFraction : nudgeFraction;
  const deltas: Partial<Record<string, FractionDelta>> = {
    ArrowLeft: { x: -step, y: 0 },
    ArrowRight: { x: step, y: 0 },
    ArrowUp: { x: 0, y: -step },
    ArrowDown: { x: 0, y: step },
  };

  return deltas[key];
}

/**
 * Ground distance between two places: great-circle metres for latitude/longitude, straight-line
 * metres on generated terrain's nominal scale. Undefined when the kinds differ.
 */
export function distanceBetweenPlaces(from: MapLocation, to: MapLocation): number | undefined {
  if (from.kind === 'local' && to.kind === 'local') {
    return Math.hypot(to.eastMeters - from.eastMeters, to.southMeters - from.southMeters);
  }

  if (from.kind === 'geographic' && to.kind === 'geographic') {
    const latitudeFrom = toRadians(from.latitude);
    const latitudeTo = toRadians(to.latitude);
    const haversine =
      Math.sin((latitudeTo - latitudeFrom) / 2) ** 2 +
      Math.cos(latitudeFrom) *
        Math.cos(latitudeTo) *
        Math.sin(toRadians(to.longitude - from.longitude) / 2) ** 2;

    return 2 * earthRadiusMeters * Math.asin(Math.min(1, Math.sqrt(haversine)));
  }

  return undefined;
}

/** Initial bearing from `from` to `to` in degrees clockwise from north, in [0, 360). */
export function bearingDegrees(from: MapLocation, to: MapLocation): number | undefined {
  if (from.kind === 'local' && to.kind === 'local') {
    return normaliseDegrees(
      toDegrees(Math.atan2(to.eastMeters - from.eastMeters, from.southMeters - to.southMeters)),
    );
  }

  if (from.kind === 'geographic' && to.kind === 'geographic') {
    const latitudeFrom = toRadians(from.latitude);
    const latitudeTo = toRadians(to.latitude);
    const longitudeDelta = toRadians(to.longitude - from.longitude);

    return normaliseDegrees(
      toDegrees(
        Math.atan2(
          Math.sin(longitudeDelta) * Math.cos(latitudeTo),
          Math.cos(latitudeFrom) * Math.sin(latitudeTo) -
            Math.sin(latitudeFrom) * Math.cos(latitudeTo) * Math.cos(longitudeDelta),
        ),
      ),
    );
  }

  return undefined;
}

/** `850 m` under a kilometre, `3.75 km` from one up (three significant figures). */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${String(Math.round(meters))} m`;
  }

  return `${String(Number((meters / 1000).toPrecision(3)))} km`;
}

/** Whole degrees, zero-padded like a compass: `007°`. */
export function formatBearing(degrees: number): string {
  return `${String(Math.round(degrees) % 360).padStart(3, '0')}°`;
}

// === HELPERS ===

function getHandleDirection(handle: CropHandle): [-1 | 0 | 1, -1 | 0 | 1] {
  const directionX = handle.endsWith('left') ? -1 : handle.endsWith('right') ? 1 : 0;
  const directionY = handle.startsWith('top') ? -1 : handle.startsWith('bottom') ? 1 : 0;

  return [directionX, directionY];
}

/** Length the crop can grow to along one axis while its anchor stays put. */
function getRoom(direction: -1 | 0 | 1, start: number, length: number, total: number): number {
  if (direction === 1) {
    return total - start;
  }

  if (direction === -1) {
    return start + length;
  }

  const center = start + length / 2;

  return 2 * Math.min(center, total - center);
}

/** The opposite edge stays fixed, or the centre on an axis the handle ignores. */
function anchorCenter(
  direction: -1 | 0 | 1,
  start: number,
  length: number,
  nextLength: number,
): number {
  if (direction === 1) {
    return start + nextLength / 2;
  }

  if (direction === -1) {
    return start + length - nextLength / 2;
  }

  return start + length / 2;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function normaliseDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}
