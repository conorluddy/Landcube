import assert from 'node:assert/strict';
import test from 'node:test';
import { analyticsConsentStorageKey } from '../analytics-consent';
import { renderMarkup } from '../ui/test-helpers';
import { AnalyticsConsentDialog } from './analytics-consent-dialog';

const storageWith = (value: string | null) => ({
  getItem: () => value,
  setItem: () => undefined,
});

void test('the hosted site asks until a choice is remembered', () => {
  const markup = renderMarkup(
    <AnalyticsConsentDialog hostname="landcu.be" storage={storageWith(null)} />,
  );

  assert.match(markup, /role="alertdialog"/);
  assert.match(markup, /No thanks/);
  assert.match(markup, /Allow analytics/);
});

void test('a remembered choice or another host shows no dialog', () => {
  for (const [hostname, stored] of [
    ['landcu.be', 'granted'],
    ['landcu.be', 'denied'],
    ['localhost', null],
  ] as const) {
    assert.equal(
      renderMarkup(<AnalyticsConsentDialog hostname={hostname} storage={storageWith(stored)} />),
      '',
      `${hostname} ${String(stored)} (${analyticsConsentStorageKey})`,
    );
  }
});
