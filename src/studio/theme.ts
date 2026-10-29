/**
 * Studio colour theme. Dark is the design default; light is provisional and opt-in only, so
 * `prefers-color-scheme` is deliberately ignored (decision recorded on #100). The choice persists in
 * localStorage and is applied as `data-theme` on `<html>`, which `src/ui/tokens.css` switches on.
 */

export type StudioTheme = 'dark' | 'light';

export const themeStorageKey = 'landcube-theme';

const defaultTheme: StudioTheme = 'dark';
const listeners = new Set<(theme: StudioTheme) => void>();

// === PUBLIC API ===

export function readTheme(storage: Pick<Storage, 'getItem'>): StudioTheme {
  try {
    return storage.getItem(themeStorageKey) === 'light' ? 'light' : defaultTheme;
  } catch {
    return defaultTheme;
  }
}

/** Applies the theme to the document, persists it and notifies subscribers. Safe to call repeatedly. */
export function applyTheme(
  theme: StudioTheme,
  root: Pick<HTMLElement, 'dataset'>,
  storage: Pick<Storage, 'setItem' | 'removeItem'>,
): void {
  if (theme === defaultTheme) {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = theme;
  }

  try {
    if (theme === defaultTheme) {
      storage.removeItem(themeStorageKey);
    } else {
      storage.setItem(themeStorageKey, theme);
    }
  } catch {
    // Storage may be blocked; the theme still applies for this visit.
  }

  for (const listener of listeners) {
    listener(theme);
  }
}

export function subscribeToTheme(listener: (theme: StudioTheme) => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function currentTheme(root: Pick<HTMLElement, 'dataset'>): StudioTheme {
  return root.dataset.theme === 'light' ? 'light' : defaultTheme;
}
