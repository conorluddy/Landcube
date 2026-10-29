import assert from 'node:assert/strict';
import test from 'node:test';
import { faultCodes, getFault } from './faults';
import { operationErrorCodes } from './operations';

void test('every operation error code maps to a fault', () => {
  for (const code of Object.values(operationErrorCodes)) {
    assert.match(getFault(code).code, /^E-\d{3}$/, code);
  }
});

void test('fault codes are unique', () => {
  const codes = Object.values(faultCodes).map((description) => description.code);

  assert.equal(new Set(codes).size, codes.length);
});

void test('fault codes sit in their range', () => {
  const expectedHundreds: Record<keyof typeof faultCodes, number> = {
    [operationErrorCodes.invalidSettings]: 1,
    [operationErrorCodes.unsupportedVersion]: 1,
    [operationErrorCodes.storageFailed]: 1,
    [operationErrorCodes.urlFailed]: 1,
    [operationErrorCodes.clipboardFailed]: 1,
    [operationErrorCodes.mapDataFailed]: 2,
    [operationErrorCodes.placeSearchFailed]: 2,
    [operationErrorCodes.exportFailed]: 4,
    tileDownloadFailed: 2,
    tileDecodeFailed: 2,
    locationOutOfRange: 2,
    webglUnavailable: 3,
    webglContextLost: 3,
    previewDecodeFailed: 3,
  };

  for (const [key, description] of Object.entries(faultCodes)) {
    const hundreds = Math.floor(Number(description.code.slice(2)) / 100);

    assert.equal(hundreds, expectedHundreds[key as keyof typeof faultCodes], key);
  }
});

void test('studio failures resolve with a title and retryability', () => {
  assert.deepEqual(getFault('tileDownloadFailed'), {
    code: 'E-201',
    title: 'Tile download failed',
    isRetryable: true,
  });
  assert.equal(getFault('locationOutOfRange').isRetryable, false);
});
