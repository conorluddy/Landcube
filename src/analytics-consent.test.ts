import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyticsConsentStorageKey,
  isAnalyticsHost,
  readAnalyticsConsent,
  saveAnalyticsConsent,
} from './analytics-consent';

function createStorage(initial?: string) {
  const values = new Map<string, string>();

  if (initial !== undefined) {
    values.set(analyticsConsentStorageKey, initial);
  }

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

void test('only the hosted site asks for analytics consent', () => {
  assert.equal(isAnalyticsHost('landcu.be'), true);
  assert.equal(isAnalyticsHost('localhost'), false);
  assert.equal(isAnalyticsHost('someone.github.io'), false);
});

void test('a saved choice is remembered and anything else counts as unset', () => {
  const storage = createStorage();

  assert.equal(readAnalyticsConsent(storage), 'unset');
  assert.deepEqual(saveAnalyticsConsent(storage, 'granted'), { ok: true, data: undefined });
  assert.equal(readAnalyticsConsent(storage), 'granted');
  saveAnalyticsConsent(storage, 'denied');
  assert.equal(readAnalyticsConsent(storage), 'denied');
  assert.equal(readAnalyticsConsent(createStorage('maybe')), 'unset');
});

void test('blocked storage reads as unset and reports a failed save', () => {
  const blocked = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
  };
  const saved = saveAnalyticsConsent(blocked, 'granted');

  assert.equal(readAnalyticsConsent(blocked), 'unset');
  assert.equal(saved.ok, false);
});
