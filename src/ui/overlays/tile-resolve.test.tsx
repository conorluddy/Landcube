import assert from 'node:assert/strict';
import test from 'node:test';
import { renderMarkup } from '../test-helpers';
import { getCentreOutRanks, getTileGrid, TileResolve } from './tile-resolve';

void test('tile grid is near-square and falls back to 3 by 3 when the total is unknown', () => {
  assert.deepEqual(getTileGrid(9), { columns: 3, rows: 3 });
  assert.deepEqual(getTileGrid(6), { columns: 3, rows: 2 });
  assert.deepEqual(getTileGrid(0), { columns: 3, rows: 3 });
});

void test('cells fill from the centre outwards', () => {
  const ranks = getCentreOutRanks(3, 3);

  assert.equal(ranks[4], 0);
  assert.ok([0, 2, 6, 8].every((corner) => ranks[corner] >= 5));
});

void test('TileResolve resolves cells in proportion to loaded tiles', () => {
  const markup = renderMarkup(<TileResolve loadedTiles={3} totalTiles={9} />);

  assert.equal(markup.match(/data-resolved="true"/g)?.length, 3);
  assert.equal(markup.match(/lc-tile-resolve__cell/g)?.length, 9);
});

void test('TileResolve is decorative', () => {
  const markup = renderMarkup(<TileResolve loadedTiles={0} totalTiles={0} />);

  assert.match(markup, /aria-hidden="true"/);
  assert.ok(!markup.includes('data-resolved'));
});
