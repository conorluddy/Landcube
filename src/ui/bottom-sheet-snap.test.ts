import assert from 'node:assert/strict';
import test from 'node:test';
import { measureSnapHeights, pickSnap } from './bottom-sheet-snap';

const heights = measureSnapHeights(844, 190, 64);

void test('snap heights on a 390x844 phone: peek 190, half 55%, full 64px from the top', () => {
  assert.deepEqual(heights, { closed: 28, peek: 190, half: 844 * 0.55, full: 780 });
  assert.ok(heights.half <= 844 * 0.62);
});

void test('a slow release settles on the nearest snap', () => {
  assert.equal(pickSnap(200, 0, heights), 'peek');
  assert.equal(pickSnap(430, 0.2, heights), 'half');
  assert.equal(pickSnap(700, -0.4, heights), 'full');
});

void test('a fast upward flick steps to the next snap above the release point', () => {
  assert.equal(pickSnap(200, 0.6, heights), 'half');
  assert.equal(pickSnap(470, 0.6, heights), 'full');
  assert.equal(pickSnap(790, 2, heights), 'full');
});

void test('a fast downward flick steps to the next snap below, even near a higher snap', () => {
  assert.equal(pickSnap(760, -0.6, heights), 'half');
  assert.equal(pickSnap(450, -0.6, heights), 'peek');
  assert.equal(pickSnap(150, -3, heights), 'closed');
});

void test('a drag down past peek closes the sheet to its handle, and a flick up reopens it', () => {
  assert.equal(pickSnap(60, 0, heights), 'closed');
  assert.equal(pickSnap(28, 0.6, heights), 'peek');
});

void test('exactly the threshold velocity is not a flick', () => {
  assert.equal(pickSnap(250, 0.5, heights), 'peek');
});

void test('a short container never lets half or full drop below peek', () => {
  assert.deepEqual(measureSnapHeights(200, 190, 64), {
    closed: 28,
    peek: 190,
    half: 190,
    full: 190,
  });
});
