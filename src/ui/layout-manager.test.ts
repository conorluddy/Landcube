import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cascadePosition,
  clampToViewport,
  createPinnedPlaceholder,
  nextZIndex,
  snapToGrid,
} from './layout-manager';

const bounds = { leftPx: 12, topPx: 60, rightPx: 800, bottomPx: 660 };
const panelSize = { widthPx: 320, heightPx: 200 };

void test('positions snap to the nearest 12px grid line', () => {
  assert.deepEqual(snapToGrid({ xPx: 124, yPx: 178 }), { xPx: 120, yPx: 180 });
  assert.deepEqual(snapToGrid({ xPx: -5, yPx: 6 }), { xPx: 0, yPx: 12 });
  assert.deepEqual(snapToGrid({ xPx: 50, yPx: 50 }, 48), { xPx: 48, yPx: 48 });
});

void test('a panel inside the bounds keeps its position', () => {
  assert.deepEqual(clampToViewport({ xPx: 120, yPx: 120 }, panelSize, bounds), {
    xPx: 120,
    yPx: 120,
  });
});

void test('a panel past an edge is pulled back so it fits entirely', () => {
  assert.deepEqual(clampToViewport({ xPx: 700, yPx: 600 }, panelSize, bounds), {
    xPx: 480,
    yPx: 460,
  });
  assert.deepEqual(clampToViewport({ xPx: -40, yPx: 0 }, panelSize, bounds), {
    xPx: 12,
    yPx: 60,
  });
});

void test('a panel larger than the bounds keeps its top-left edge visible', () => {
  assert.deepEqual(
    clampToViewport({ xPx: 300, yPx: 300 }, { widthPx: 900, heightPx: 900 }, bounds),
    { xPx: 12, yPx: 60 },
  );
});

void test('the raised panel goes one above the highest z-index', () => {
  assert.equal(nextZIndex([]), 1);
  assert.equal(
    nextZIndex([
      { id: 'lens', position: { xPx: 0, yPx: 0 }, zIndex: 3 },
      { id: 'focus', position: { xPx: 0, yPx: 0 }, zIndex: 7 },
    ]),
    8,
  );
});

void test('new panels cascade by 24px from 24/72', () => {
  assert.deepEqual(cascadePosition(0), { xPx: 24, yPx: 72 });
  assert.deepEqual(cascadePosition(2), { xPx: 72, yPx: 120 });
});

void test('the inspector placeholder names the pinned group and offers Dock', () => {
  let dockCount = 0;
  const placeholder = createPinnedPlaceholder(
    { id: 'contour-density', title: 'Contour density', rows: [], isPinnable: true },
    () => {
      dockCount += 1;
    },
  );

  assert.equal(placeholder.id, 'contour-density');
  assert.equal(placeholder.isPinnable, undefined);
  assert.deepEqual(
    placeholder.rows.map((row) => (row === false || row === undefined ? undefined : row.id)),
    ['contour-density-pinned', 'contour-density-dock'],
  );

  const dockRow = placeholder.rows[1];

  assert.ok(dockRow !== false && dockRow?.kind === 'button');
  dockRow.onClick?.();
  assert.equal(dockCount, 1);
});
