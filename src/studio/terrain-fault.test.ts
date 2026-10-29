import assert from 'node:assert/strict';
import test from 'node:test';
import { TerrainLoadError } from '../terrain-load-error';
import { describeTerrainFault } from './terrain-fault';

void test('a failed tile download maps to E-201 with a tile metric', () => {
  const fault = describeTerrainFault(
    new TerrainLoadError('tileDownloadFailed', 'Terrain tile download failed (HTTP 503).'),
    { loaded: 3, total: 9 },
  );

  assert.equal(fault.code, 'E-201');
  assert.equal(fault.metric, '3 of 9 tiles');
  assert.equal(fault.message, 'Terrain tile download failed (HTTP 503).');
  assert.equal(fault.isRetryable, true);
});

void test('a decode failure maps to E-204', () => {
  const fault = describeTerrainFault(new TerrainLoadError('tileDecodeFailed', 'Bad tile.'), null);

  assert.equal(fault.code, 'E-204');
  assert.equal(fault.metric, undefined);
});

void test('an out-of-range location is E-205 and not retryable', () => {
  const fault = describeTerrainFault(new TerrainLoadError('locationOutOfRange', 'Use latitude.'), {
    loaded: 0,
    total: 4,
  });

  assert.equal(fault.code, 'E-205');
  assert.equal(fault.isRetryable, false);
  assert.equal(fault.metric, undefined);
});

void test('an unclassified error counts as a download failure', () => {
  assert.equal(describeTerrainFault(new Error('boom'), null).code, 'E-201');
  assert.equal(describeTerrainFault('boom', null).message, 'Terrain could not load. Please retry.');
});
