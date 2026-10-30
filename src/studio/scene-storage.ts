/**
 * The 3D look a browser keeps between visits: materials, colours, water, lighting, floor, roads and
 * grass. Camera, turntable, daylight sweep and the water-level preview stay session-only. Restores
 * field by field, so a stale or tampered field falls back to its default without losing the rest.
 */
import { grassPresets } from '../constants/grass';
import { operationErrorCodes } from '../constants/operations';
import { roadDetails } from '../constants/roads';
import type { WaterStyle } from '../terrain-3d';
import type { TurntableDirection } from '../terrain-camera';
import type { ContourEngravingSettings } from '../terrain-contour-engraving';
import {
  elevationGradientPresets,
  landscapeGradientPresets,
  validateElevationGradient,
} from '../terrain-elevation-gradient';
import type { FloorStyle } from '../terrain-floor-styles';
import { landFinishes, terrainMaterialPresets, waterFinishes } from '../terrain-materials';
import type { Result } from '../types/operations';
import type { SceneSettings } from './controller';

export const sceneStorageKey = 'landcube-scene';

const storedSceneVersion = 1;
const sessionOnlySceneKeys = [
  'camera',
  'rotating',
  'daylightCycle',
  'previewWater',
  'previewWaterLevel',
] as const satisfies readonly (keyof SceneSettings)[];

/** Every scene text field that is not a colour picks from a list; a field missing here never restores. */
export const sceneFieldChoices: Readonly<Partial<Record<string, readonly string[]>>> = {
  materialPreset: [...Object.keys(terrainMaterialPresets), 'custom'],
  landFinish: Object.keys(landFinishes),
  waterFinish: Object.keys(waterFinishes),
  gradientPreset: [
    ...Object.keys(elevationGradientPresets),
    ...Object.keys(landscapeGradientPresets),
    'custom',
  ],
  gradientSource: ['location', 'user'],
  'gradient.transition': ['soft', 'hard'],
  floorStyle: ['survey', 'plinth', 'rose', 'graticule', 'crop'] satisfies FloorStyle[],
  waterStyle: ['hatched', 'solid', 'off'] satisfies WaterStyle[],
  rotationDirection: ['counterclockwise', 'clockwise'] satisfies TurntableDirection[],
  'engraving.treatment': ['drawn', 'engraved'] satisfies ContourEngravingSettings['treatment'][],
  'roads.detail': roadDetails,
  'grass.preset': [...Object.keys(grassPresets), 'custom'],
};

// === PUBLIC API ===

/** Restores the stored 3D look over `defaults`; nothing stored yields `defaults` unchanged. */
export function readStoredScene(
  storage: Pick<Storage, 'getItem'>,
  defaults: SceneSettings,
): Result<SceneSettings> {
  let raw: string | null;

  try {
    raw = storage.getItem(sceneStorageKey);
  } catch {
    return storedSceneFailure('Browser storage is unavailable, so the 3D look resets each visit.');
  }

  if (raw === null) {
    return { ok: true, data: defaults };
  }

  let stored: unknown;

  try {
    stored = JSON.parse(raw);
  } catch {
    return storedSceneFailure(
      'The saved 3D look is unreadable. Change any 3D setting to replace it.',
    );
  }

  if (!isRecord(stored) || stored.version !== storedSceneVersion) {
    return storedSceneFailure(
      `The saved 3D look is not version ${String(storedSceneVersion)}. Change any 3D setting to replace it.`,
    );
  }

  const scene = mergeStoredValue(defaults, stored.scene, '') as SceneSettings;

  for (const key of sessionOnlySceneKeys) {
    Object.assign(scene, { [key]: defaults[key] });
  }

  try {
    validateElevationGradient(scene.gradient);
  } catch {
    scene.gradient = defaults.gradient;
  }

  return { ok: true, data: scene };
}

/** Saves the 3D look, leaving out session-only settings. Safe to call on every change. */
export function saveStoredScene(
  storage: Pick<Storage, 'setItem'>,
  scene: SceneSettings,
): Result<void> {
  const persisted = Object.fromEntries(
    Object.entries(scene).filter(([key]) => !isSessionOnlySceneKey(key)),
  );

  try {
    storage.setItem(
      sceneStorageKey,
      JSON.stringify({ version: storedSceneVersion, scene: persisted }),
    );

    return { ok: true, data: undefined };
  } catch {
    return storedSceneFailure('Could not save the 3D look; it resets next visit.');
  }
}

// === HELPERS ===

/** Keeps `stored` where it matches the shape of `fallback`; `path` names the field for choice lookup. */
function mergeStoredValue(fallback: unknown, stored: unknown, path: string): unknown {
  // Gradient stops are the only array; the whole gradient is validated after merging.
  if (Array.isArray(fallback)) {
    return Array.isArray(stored) ? stored : fallback;
  }

  if (isRecord(fallback)) {
    if (!isRecord(stored)) {
      return fallback;
    }

    return Object.fromEntries(
      Object.entries(fallback).map(([key, value]) => [
        key,
        mergeStoredValue(value, stored[key], path ? `${path}.${key}` : key),
      ]),
    );
  }

  if (typeof fallback === 'string') {
    return typeof stored === 'string' && isAllowedSceneText(stored, fallback, path)
      ? stored
      : fallback;
  }

  if (typeof fallback === 'number') {
    return typeof stored === 'number' && Number.isFinite(stored) ? stored : fallback;
  }

  return typeof stored === typeof fallback ? stored : fallback;
}

function isSessionOnlySceneKey(key: string): boolean {
  return (sessionOnlySceneKeys as readonly string[]).includes(key);
}

function isAllowedSceneText(value: string, fallback: string, path: string): boolean {
  if (hexColorPattern.test(fallback)) {
    return hexColorPattern.test(value);
  }

  return sceneFieldChoices[path]?.includes(value) ?? false;
}

const hexColorPattern = /^#[0-9a-f]{6}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function storedSceneFailure(message: string): Result<never> {
  return {
    ok: false,
    error: { code: operationErrorCodes.storageFailed, message, retryable: true },
  };
}
