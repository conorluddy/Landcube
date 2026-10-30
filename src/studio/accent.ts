/**
 * Signal accent: the colour of OK and live marks. Bone is the default; amber and phosphor are
 * opt-in. Applied as `data-signal-accent` on `<html>` (`src/ui/signal-accent.css` maps it to
 * `--lc-signal`) and persisted in localStorage, like the theme in `./theme.ts`.
 */

export type SignalAccent = 'bone' | 'amber' | 'phosphor';

export const signalAccents: readonly SignalAccent[] = ['bone', 'amber', 'phosphor'];

const defaultAccent: SignalAccent = 'bone';

// === PUBLIC API ===

export function readSignalAccent(
  storage: Pick<Storage, 'getItem'>,
  storageKey: string,
): SignalAccent {
  try {
    const stored = storage.getItem(storageKey);

    return signalAccents.find((accent) => accent === stored) ?? defaultAccent;
  } catch {
    return defaultAccent;
  }
}

/** Applies the accent to the document and persists it. Safe to call repeatedly. */
export function applySignalAccent(
  accent: SignalAccent,
  root: Pick<HTMLElement, 'dataset'>,
  storage: Pick<Storage, 'setItem' | 'removeItem'>,
  storageKey: string,
): void {
  if (accent === defaultAccent) {
    delete root.dataset.signalAccent;
  } else {
    root.dataset.signalAccent = accent;
  }

  try {
    if (accent === defaultAccent) {
      storage.removeItem(storageKey);
    } else {
      storage.setItem(storageKey, accent);
    }
  } catch {
    // Storage may be blocked; the accent still applies for this visit.
  }
}

export function currentSignalAccent(root: Pick<HTMLElement, 'dataset'>): SignalAccent {
  return signalAccents.find((accent) => accent === root.dataset.signalAccent) ?? defaultAccent;
}
