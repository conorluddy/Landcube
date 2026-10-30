/**
 * Whether studio sound effects play. On by default; muting persists in localStorage so a visitor
 * who silenced the rumble isn't surprised by it next time.
 */

export const soundMutedStorageKey = 'landcube-sound-muted';

const listeners = new Set<(isMuted: boolean) => void>();
let isMutedCache: boolean | undefined;

// === PUBLIC API ===

export function readSoundMuted(storage: Pick<Storage, 'getItem'>): boolean {
  try {
    return storage.getItem(soundMutedStorageKey) === 'true';
  } catch {
    return false;
  }
}

export function isSoundMuted(): boolean {
  isMutedCache ??= readSoundMuted(browserStorage());

  return isMutedCache;
}

/** Persists the choice and notifies subscribers. Safe to call repeatedly. */
export function setSoundMuted(
  isMuted: boolean,
  storage: Pick<Storage, 'setItem' | 'removeItem'> = browserStorage(),
): void {
  isMutedCache = isMuted;

  try {
    if (isMuted) {
      storage.setItem(soundMutedStorageKey, 'true');
    } else {
      storage.removeItem(soundMutedStorageKey);
    }
  } catch {
    // Storage may be blocked; the choice still holds for this visit.
  }

  for (const listener of listeners) {
    listener(isMuted);
  }
}

export function subscribeToSoundMuted(listener: (isMuted: boolean) => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

// === HELPERS ===

/** Touching `localStorage` throws when storage is blocked, so it resolves lazily inside callers' try/catch. */
function browserStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  return {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => {
      localStorage.setItem(key, value);
    },
    removeItem: (key) => {
      localStorage.removeItem(key);
    },
  };
}
