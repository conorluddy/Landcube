import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  isAnalyticsHost,
  loadAnalytics,
  readAnalyticsConsent,
  saveAnalyticsConsent,
} from '../analytics-consent';
import { logOperationError } from '../operation-logging';
import { Button } from '../ui/button';
import { GlassPanel } from '../ui/glass-panel';
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
        <GlassPanel className="lc-route-confirm__card">
          <strong>Help improve LANDCU.BE?</strong>
          <span>
            Allow anonymous usage analytics from Google Analytics: which features get used and when
            something fails. Seeds, locations and routes are never sent.
          </span>
          <div className="lc-route-confirm__actions">
            <Button
              ref={declineButton}
              onClick={() => {
                choose('denied');
              }}
            >
              No thanks
            </Button>
            <Button
              onClick={() => {
                choose('granted');
              }}
            >
              Allow analytics
            </Button>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
