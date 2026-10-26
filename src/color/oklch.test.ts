import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hexToOklch, mixOklch, oklchToHex } from './oklch';

void test('hex colours survive an OKLCH round trip', () => {
  for (const hex of ['#000000', '#ffffff', '#ff0000', '#20383e', '#dfa764', '#7a3b2a']) {
    assert.equal(oklchToHex(hexToOklch(hex)), hex);
  }
});

void test('mixes land exactly on their endpoints', () => {
  assert.equal(mixOklch('#a5532e', '#4f6b43', 0), '#a5532e');
  assert.equal(mixOklch('#a5532e', '#4f6b43', 1), '#4f6b43');
});

void test('hue takes the shorter arc across red', () => {
  const purple = hexToOklch('#cc33ff');
  const orange = hexToOklch('#ff9900');
  const middle = hexToOklch(mixOklch('#cc33ff', '#ff9900', 0.5));

  assert.ok(purple.hue > 300 && orange.hue < 90);
  assert.ok(middle.hue > purple.hue || middle.hue < orange.hue);
});

void test('blending from grey keeps the coloured endpoint hue', () => {
  const target = hexToOklch('#3366cc');
  const middle = hexToOklch(mixOklch('#808080', '#3366cc', 0.5));

  assert.ok(Math.abs(middle.hue - target.hue) < 1);
});
