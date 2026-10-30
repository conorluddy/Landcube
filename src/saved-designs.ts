import {
  savedDesignLimit,
  savedDesignsStorageKey,
  savedDesignThumbnailMaxBytes,
} from './constants/library';
import { operationErrorCodes } from './constants/operations';
import type { OperationError, Result } from './types/operations';

/** A design kept in the Library: the design link plus a small preview. Local placeholder until accounts exist. */
export interface SavedDesign {
  id: string;
  name: string;
  /** ISO 8601 timestamp. */
  savedAt: string;
  /** The design link the existing sharing code produces; restoring parses it. */
  link: string;
  /** Preview SVG, at most `savedDesignThumbnailMaxBytes`; null when it was too large or unavailable. */
  thumbnailSvg: string | null;
  source: 'procedural' | 'real';
  /** The seed for procedural designs, the place name for real ones. */
  seedOrPlace: string;
}

// === PUBLIC API ===

/**
 * Saved designs, newest first. Corrupt storage is an error result (the Library shows empty with a
 * message); single malformed entries are skipped.
 */
export function readSavedDesigns(storage: Pick<Storage, 'getItem'>): Result<SavedDesign[]> {
  let raw: string | null;

  try {
    raw = storage.getItem(savedDesignsStorageKey);
  } catch {
    return storageFailure('Browser storage is unavailable. The Library is empty for this visit.');
  }

  if (raw === null) {
    return { ok: true, data: [] };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return storageFailure(
      'Saved designs could not be read because stored data is corrupt. Save a design to start a fresh Library.',
    );
  }

  if (!Array.isArray(parsed)) {
    return storageFailure(
      'Saved designs could not be read because stored data is corrupt. Save a design to start a fresh Library.',
    );
  }

  return { ok: true, data: parsed.filter(isSavedDesign) };
}

export function writeSavedDesigns(
  storage: Pick<Storage, 'setItem'>,
  designs: readonly SavedDesign[],
): Result<void> {
  try {
    storage.setItem(savedDesignsStorageKey, JSON.stringify(designs));

    return { ok: true, data: undefined };
  } catch {
    return storageFailure('Could not save the design. It stays in the Library for this visit.');
  }
}

/** Puts `design` first, replacing any entry with the same id, and keeps the newest `savedDesignLimit`. */
export function addSavedDesign(saved: readonly SavedDesign[], design: SavedDesign): SavedDesign[] {
  return [design, ...saved.filter((existing) => existing.id !== design.id)].slice(
    0,
    savedDesignLimit,
  );
}

export function removeSavedDesign(saved: readonly SavedDesign[], id: string): SavedDesign[] {
  return saved.filter((existing) => existing.id !== id);
}

/** The thumbnail when it fits the size budget, otherwise null. */
export function fitThumbnail(svg: string): string | null {
  return new TextEncoder().encode(svg).length <= savedDesignThumbnailMaxBytes ? svg : null;
}

// === HELPERS ===

function isSavedDesign(value: unknown): value is SavedDesign {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const design = value as Record<string, unknown>;

  return (
    typeof design.id === 'string' &&
    typeof design.name === 'string' &&
    typeof design.savedAt === 'string' &&
    typeof design.link === 'string' &&
    (design.thumbnailSvg === null || typeof design.thumbnailSvg === 'string') &&
    (design.source === 'procedural' || design.source === 'real') &&
    typeof design.seedOrPlace === 'string'
  );
}

function storageFailure(message: string): { ok: false; error: OperationError } {
  return {
    ok: false,
    error: { code: operationErrorCodes.storageFailed, message, retryable: true },
  };
}
