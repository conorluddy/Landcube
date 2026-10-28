import { savedPlaceLimit, savedPlacesStorageKey } from './constants/place-search';
import { operationErrorCodes } from './constants/operations';
import type { OperationError, Result } from './types/operations';

/** A searched place whose terrain loaded; listed before the presets in the location menu. */
export interface SavedPlace {
  name: string;
  /** Region and country from the search match; may be empty. */
  region: string;
  latitude: number;
  longitude: number;
}

/** Saved places, most recent first; entries that are not places are skipped rather than failing. */
export function readSavedPlaces(storage: Pick<Storage, 'getItem'>): Result<SavedPlace[]> {
  let raw: string | null;

  try {
    raw = storage.getItem(savedPlacesStorageKey);
  } catch {
    return storageFailure('Browser storage is unavailable. Searched places last for this visit.');
  }

  if (raw === null) {
    return { ok: true, data: [] };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: true, data: [] };
  }

  return { ok: true, data: Array.isArray(parsed) ? parsed.filter(isSavedPlace) : [] };
}

/** Moves `place` to the front of the saved list, keeping the newest `savedPlaceLimit`. */
export function addSavedPlace(saved: SavedPlace[], place: SavedPlace): SavedPlace[] {
  return [place, ...saved.filter((existing) => !isSameSavedPlace(existing, place))].slice(
    0,
    savedPlaceLimit,
  );
}

export function writeSavedPlaces(
  storage: Pick<Storage, 'setItem'>,
  places: SavedPlace[],
): Result<void> {
  try {
    storage.setItem(savedPlacesStorageKey, JSON.stringify(places));

    return { ok: true, data: undefined };
  } catch {
    return storageFailure('Could not save the searched place. It stays listed for this visit.');
  }
}

/** Same coordinates to about ten metres. */
export function isSameSavedPlace(
  a: Pick<SavedPlace, 'latitude' | 'longitude'>,
  b: Pick<SavedPlace, 'latitude' | 'longitude'>,
): boolean {
  return Math.abs(a.latitude - b.latitude) < 1e-4 && Math.abs(a.longitude - b.longitude) < 1e-4;
}

// === HELPERS ===

function isSavedPlace(value: unknown): value is SavedPlace {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const place = value as Record<string, unknown>;

  return (
    typeof place.name === 'string' &&
    typeof place.region === 'string' &&
    typeof place.latitude === 'number' &&
    typeof place.longitude === 'number' &&
    Number.isFinite(place.latitude) &&
    Number.isFinite(place.longitude)
  );
}

function storageFailure(message: string): { ok: false; error: OperationError } {
  return {
    ok: false,
    error: { code: operationErrorCodes.storageFailed, message, retryable: true },
  };
}
