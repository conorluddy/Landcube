import { useSyncExternalStore } from 'react';

/**
 * The live computed value of a `--lc-*` token on `<html>`, so foundation plates show what ships
 * rather than a copy. Re-read when a root attribute changes (theme, signal accent).
 */
export function useTokenValue(token: string): string {
  return useSyncExternalStore(
    subscribeToRootAttributes,
    () => readTokenValue(token),
    () => '',
  );
}

function subscribeToRootAttributes(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);

  observer.observe(document.documentElement, { attributes: true });

  return () => {
    observer.disconnect();
  };
}

function readTokenValue(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
}
