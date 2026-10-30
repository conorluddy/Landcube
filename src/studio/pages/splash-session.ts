import { splashSeenStorageKey } from '../../constants/library';

/**
 * The splash is a phone-only first-visit screen, shown once per browser session. It is skipped when
 * the viewport is not a phone (decided at load, so resizing later never raises it), when the URL is
 * a design link (a shared link opens straight into the studio), and once the session key is set.
 * This is what keeps the existing 390px e2e specs, which all open design links, free of the splash.
 */
export function shouldShowSplash(
  isPhoneViewport: boolean,
  isDesignLink: boolean,
  session: Pick<Storage, 'getItem'>,
): boolean {
  if (!isPhoneViewport || isDesignLink) {
    return false;
  }

  try {
    return session.getItem(splashSeenStorageKey) === null;
  } catch {
    return true;
  }
}

/** Records that this session has seen the splash. Blocked storage only means it may show again. */
export function markSplashSeen(session: Pick<Storage, 'setItem'>): void {
  try {
    session.setItem(splashSeenStorageKey, '1');
  } catch {
    // The splash may reappear on reload; nothing to recover.
  }
}
