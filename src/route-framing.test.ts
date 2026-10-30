import assert from 'node:assert/strict';
import test from 'node:test';
import { frameRoute, isRouteFramed } from './route-framing';

// About 1.1 km north to south at Errigal's latitude.
const ridge = [
  { latitude: 55.012, longitude: -8.148 },
  { latitude: 55.018, longitude: -8.14 },
  { latitude: 55.024, longitude: -8.132 },
];

void test('a route is framed at its centre with the smallest span stop that holds it', () => {
  const framing = frameRoute(ridge);

  assert.ok(framing);
  assert.equal(framing.latitude, 55.018);
  assert.equal(framing.longitude, -8.14);
  assert.equal(framing.spanKm, 2);
});

void test('fewer than two points cannot be framed', () => {
  assert.equal(frameRoute([]), undefined);
  assert.equal(frameRoute(ridge.slice(0, 1)), undefined);
});

void test('a route wider than the largest span gets the largest span', () => {
  const framing = frameRoute([
    { latitude: 50, longitude: -10 },
    { latitude: 52, longitude: -2 },
  ]);

  assert.equal(framing?.spanKm, 200);
});

void test('terrain centred on the route with every point inside needs no re-centring', () => {
  const terrain = { location: { latitude: 55.018, longitude: -8.14 }, spanKm: 8 };

  assert.equal(isRouteFramed(ridge, terrain, ridge.length), true);
});

void test('a route off the terrain centre or partly outside it is worth re-centring', () => {
  const offCentre = { location: { latitude: 55.06, longitude: -8.14 }, spanKm: 8 };
  const centred = { location: { latitude: 55.018, longitude: -8.14 }, spanKm: 8 };

  assert.equal(isRouteFramed(ridge, offCentre, ridge.length), false);
  assert.equal(isRouteFramed(ridge, centred, ridge.length - 1), false);
});
