import { cachedPlaceSearchLimit } from '../constants/place-search';
import { searchPlaces, type PlaceMatch } from '../place-search';
import type { Result } from '../types/operations';

export interface PlaceSearcher {
  /** Resolves undefined when a newer search or `cancel` superseded this one. */
  search(query: string): Promise<Result<PlaceMatch[]> | undefined>;
  cancel(): void;
}

/** One search at a time; recent queries are answered from a small session cache. */
export function createPlaceSearcher(fetchPlaces: typeof fetch): PlaceSearcher {
  // Only matches are cached; every failure is retryable.
  const cache = new Map<string, PlaceMatch[]>();
  let active: AbortController | undefined;

  return {
    async search(query) {
      active?.abort();
      const key = query.trim().toLowerCase().replace(/\s+/g, ' ');
      const cached = cache.get(key);

      if (cached) {
        // Re-inserting marks the query as most recent, so eviction drops the least recently used.
        cache.delete(key);
        cache.set(key, cached);

        return { ok: true, data: cached };
      }

      const controller = new AbortController();

      active = controller;

      try {
        const result = await searchPlaces(key, fetchPlaces, controller.signal);

        if (result.ok) {
          cache.set(key, result.data);

          // Maps keep insertion order, so the first key is the oldest query.
          for (const oldest of cache.keys()) {
            if (cache.size <= cachedPlaceSearchLimit) {
              break;
            }

            cache.delete(oldest);
          }
        }

        return controller.signal.aborted ? undefined : result;
      } catch (error) {
        if (controller.signal.aborted) {
          return undefined;
        }

        throw error;
      }
    },
    cancel() {
      active?.abort();
      active = undefined;
    },
  };
}
