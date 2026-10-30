import { maximumSeedValue, versionOneDesignDefaults } from './constants/design';
import { operationErrorCodes } from './constants/operations';
import { lockedSeedStorageKey } from './constants/sharing';
import { clampOutputDimensionPixels, getDesignUrl, parseDesignParameters } from './design-settings';
import { logOperationError } from './operation-logging';
import { keepSystemLink } from './system-link';
import type { LoadedDesign } from './types/design';
import type { ImageDimensions } from './types/dimensions';
import type { Result } from './types/operations';

// === PUBLIC API ===
/** Applies URL, locked-seed, and fresh-seed startup precedence. */
export function loadInitialDesign(
  parameters: URLSearchParams,
  viewport: ImageDimensions,
  randomSeed: number,
  storedSeed: number | null,
): Result<LoadedDesign> {
  if (hasDesignParameters(parameters)) {
    const result = parseDesignParameters(parameters);

    if (!result.ok || parameters.has('seed')) {
      return result;
    }

    return parseDesignParameters(
      new URLSearchParams([...parameters, ['seed', String(storedSeed ?? randomSeed)]]),
    );
  }

  return parseDesignParameters(new URLSearchParams(), {
    ...versionOneDesignDefaults,
    seed: storedSeed ?? randomSeed,
    width: clampOutputDimensionPixels(viewport.width),
    height: clampOutputDimensionPixels(viewport.height),
  });
}

/** True when the URL carries a design link rather than opening the studio fresh. */
export function hasDesignParameters(parameters: URLSearchParams): boolean {
  return (
    parameters.has('v') || Object.keys(versionOneDesignDefaults).some((key) => parameters.has(key))
  );
}

/** Reads and validates the optional persistent seed lock. */
export function readLockedSeed(storage: Storage): Result<number | null> {
  try {
    const raw = storage.getItem(lockedSeedStorageKey);

    if (raw === null) {
      return { ok: true, data: null };
    }

    if (/^\d+$/.test(raw) && Number(raw) <= maximumSeedValue) {
      return { ok: true, data: Number(raw) };
    }

    return {
      ok: false,
      error: {
        code: operationErrorCodes.storageFailed,
        message: 'The saved seed is invalid. Lock the current landscape to replace it.',
        retryable: true,
      },
    };
  } catch {
    return {
      ok: false,
      error: {
        code: operationErrorCodes.storageFailed,
        message:
          'Browser storage is unavailable. Seed locking works for this visit; use Copy link to save the design.',
        retryable: true,
      },
    };
  }
}

/** Persists or clears the seed lock with a recoverable failure result. */
export function saveLockedSeed(storage: Storage, seed: number | null): Result<void> {
  try {
    if (seed === null) {
      storage.removeItem(lockedSeedStorageKey);
    } else {
      storage.setItem(lockedSeedStorageKey, String(seed));
    }

    return { ok: true, data: undefined };
  } catch {
    return {
      ok: false,
      error: {
        code: operationErrorCodes.storageFailed,
        message: 'Could not save the seed lock. Use Copy link to keep this design.',
        retryable: true,
      },
    };
  }
}

/** Reports clipboard failures so the interface can offer manual copying. */
export async function copyDesignLink(
  url: string,
  clipboard: Pick<Clipboard, 'writeText'> | undefined,
): Promise<Result<void>> {
  try {
    if (!clipboard) {
      throw new Error('Clipboard unavailable');
    }

    await clipboard.writeText(url);

    return { ok: true, data: undefined };
  } catch {
    return {
      ok: false,
      error: {
        code: operationErrorCodes.clipboardFailed,
        message: 'Clipboard access is unavailable. Select and copy the link below.',
        retryable: true,
      },
    };
  }
}

/**
 * Updates the current history entry while preserving a usable share URL. The address bar keeps
 * any design-system link; the returned share URL never carries one.
 */
export function replaceDesignUrl(
  baseUrl: string,
  settings: LoadedDesign['settings'],
  history: Pick<History, 'replaceState' | 'state'>,
): string {
  const url = getDesignUrl(baseUrl, settings);

  try {
    history.replaceState(history.state, '', keepSystemLink(baseUrl, url));
  } catch {
    logOperationError({
      code: operationErrorCodes.urlFailed,
      message: 'Could not update the address bar. Use Copy link to save the design.',
      retryable: true,
    });
  }

  return url;
}
