import { clearableStoragePrefixes } from '../../constants/library';
import { operationErrorCodes } from '../../constants/operations';
import type { Result } from '../../types/operations';
import type { BrowserStorage } from '../browser-storage';

const terrainTileCachePrefix = 'topogra-terrain-tiles';

/** Removes every `landcube-*` and `topogra-*` key; resolves to how many keys were removed. */
export function clearLocalStorageKeys(storage: BrowserStorage): Result<number> {
  try {
    const keys: string[] = [];

    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);

      if (key !== null && clearableStoragePrefixes.some((prefix) => key.startsWith(prefix))) {
        keys.push(key);
      }
    }

    for (const key of keys) {
      storage.removeItem(key);
    }

    return { ok: true, data: keys.length };
  } catch {
    return {
      ok: false,
      error: {
        code: operationErrorCodes.storageFailed,
        message:
          'Browser storage is unavailable, so nothing was cleared. Check site data settings.',
        retryable: true,
      },
    };
  }
}

/** Deletes the downloaded terrain tile cache. Missing or blocked Cache Storage counts as already empty. */
export async function clearTerrainTileCache(
  cacheStorage: Pick<CacheStorage, 'keys' | 'delete'> | undefined,
): Promise<void> {
  if (cacheStorage === undefined) {
    return;
  }

  try {
    const names = await cacheStorage.keys();

    await Promise.all(
      names
        .filter((name) => name.startsWith(terrainTileCachePrefix))
        .map((name) => cacheStorage.delete(name)),
    );
  } catch {
    // Cache Storage blocked (private browsing); there is nothing stored to clear.
  }
}
