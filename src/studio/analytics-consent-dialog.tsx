import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  isAnalyticsHost,
  loadAnalytics,
  readAnalyticsConsent,
  saveAnalyticsConsent,
} from '../analytics-consent';
import { logOperationError } from '../operation-logging';
import { Button } from '../ui/button';
import { SignalMark } from '../ui/signal-mark';
import { browserLocalStorage, type BrowserStorage } from './browser-storage';

/** Asks once, on the hosted site, whether anonymous usage analytics may load; the answer is remembered. */
export function AnalyticsConsentDialog({
  hostname = location.hostname,
  storage = browserLocalStorage,
}: {
  hostname?: string;
  storage?: Pick<BrowserStorage, 'getItem' | 'setItem'>;
}): ReactNode {
  const [isOpen, setIsOpen] = useState(
    () => isAnalyticsHost(hostname) && readAnalyticsConsent(storage) === 'unset',
  );
  const declineButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      declineButton.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const choose = (consent: 'granted' | 'denied'): void => {
    const saved = saveAnalyticsConsent(storage, consent);

    if (!saved.ok) {
      logOperationError(saved.error);
    }

    if (consent === 'granted') {
      loadAnalytics();
    }

    setIsOpen(false);
  };

  return (
    <div className="lc-route-confirm">
      <div role="alertdialog" aria-modal="true" aria-label="Usage analytics">
        <section className="lc-readout-card lc-glass lc-consent-card" data-ui-surface>
          <div className="lc-readout-card__header">
            <span className="lc-readout-card__label">
              <SignalMark kind="live" />
              Analytics
            </span>
            <span className="lc-readout-card__source">Optional</span>
          </div>
          <div className="lc-readout-card__identity">
            <p className="lc-readout-card__title">Usage data</p>
            <p className="lc-readout-card__place">Anonymous · Google Analytics</p>
          </div>
          <p className="lc-consent-card__body">
            Help improve LANDCU.BE by sharing which features get used and when something fails.
            Seeds, locations and routes are never sent.
          </p>
          <div className="lc-consent-card__actions">
            <Button
              ref={declineButton}
              isFullWidth
              onClick={() => {
                choose('denied');
              }}
            >
              No thanks
            </Button>
            <Button
              isFullWidth
              onClick={() => {
                choose('granted');
              }}
            >
              Allow analytics
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
