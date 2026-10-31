/** Consent for Google Analytics on the hosted site: the tag loads only after a visitor allows it. */

import { operationErrorCodes } from './constants/operations';
import type { Result } from './types/operations';

export const analyticsHostname = 'landcu.be';
export const analyticsConsentStorageKey = 'landcube-analytics-consent';

const measurementId = 'G-09DGBRV9NB';

export type AnalyticsConsent = 'granted' | 'denied' | 'unset';

// === PUBLIC API ===

/** Only the hosted site reports, so dev servers, forks and self-hosts neither ask nor load the tag. */
export function isAnalyticsHost(hostname: string): boolean {
  return hostname === analyticsHostname;
}

/** The remembered choice; unreadable storage counts as no choice yet. */
export function readAnalyticsConsent(storage: Pick<Storage, 'getItem'>): AnalyticsConsent {
  try {
    const stored = storage.getItem(analyticsConsentStorageKey);

    return stored === 'granted' || stored === 'denied' ? stored : 'unset';
  } catch {
    return 'unset';
  }
}

/** Remembers the choice; a failure means the dialog asks again next visit. */
export function saveAnalyticsConsent(
  storage: Pick<Storage, 'setItem'>,
  consent: 'granted' | 'denied',
): Result<void> {
  try {
    storage.setItem(analyticsConsentStorageKey, consent);

    return { ok: true, data: undefined };
  } catch {
    return {
      ok: false,
      error: {
        code: operationErrorCodes.storageFailed,
        message: 'Browser storage is unavailable, so the analytics choice will not be remembered.',
        retryable: true,
      },
    };
  }
}

/** Loads Google Analytics once. Set on config so every event, not just the page view, omits the design-link query. */
export function loadAnalytics(): void {
  const analytics = window as unknown as { dataLayer?: unknown[]; gtag?: unknown };

  if (analytics.gtag !== undefined) {
    return;
  }

  const dataLayer = (analytics.dataLayer ??= []);

  // gtag.js reads `arguments` objects from the data layer, so a rest-parameter array will not do.
  analytics.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    dataLayer.push(arguments);
  };

  const gtag = analytics.gtag as (...args: unknown[]) => void;

  gtag('js', new Date());
  gtag('config', measurementId, { page_location: location.origin + location.pathname });

  const tag = document.createElement('script');

  tag.async = true;
  tag.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.append(tag);
}

/** Starts analytics at launch for a visitor who already allowed it. */
export function startAnalyticsIfAllowed(hostname: string, storage: Pick<Storage, 'getItem'>): void {
  if (isAnalyticsHost(hostname) && readAnalyticsConsent(storage) === 'granted') {
    loadAnalytics();
  }
}
