import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  boundsFromCenter,
  createFloorPlace,
  formatDecimal,
  formatDms,
  graticuleValues,
  latitudeFraction,
  pickGraticuleStep,
  pickScaleDistanceKm,
} from './floor-geo';

const aso = boundsFromCenter(32.8842, 131.104, 25, 25);

// The design mock hand-typed 59′48″ and 46′18″; rounding the computed edges gives one second less/more.
void test('Mount Aso bounds match the floor design reference', () => {
  assert.equal(formatDms(aso.north, 'lat'), '32°59′47″N');
  assert.equal(formatDms(aso.south, 'lat'), '32°46′19″N');
  assert.equal(formatDms(aso.west, 'lon'), '130°58′13″E');
  assert.equal(formatDms(aso.east, 'lon'), '131°14′16″E');
  assert.equal(formatDms(32.8842, 'lat'), '32°53′03″N');
});

void test('coordinates carry hemispheres and wrap across the antimeridian', () => {
  assert.equal(formatDecimal(-43.595, 'lat'), '43.5950°S');
  assert.equal(formatDecimal(-6.2603, 'lon'), '6.2603°W');
  assert.equal(formatDms(-0.5, 'lon', 'minutes'), '0°30′W');
  assert.equal(formatDms(181, 'lon', 'minutes'), '179°00′W');
  assert.equal(formatDms(52.99999, 'lat'), '53°00′00″N');
});

void test('a 25 km span draws 3′ graticule lines', () => {
  const step = pickGraticuleStep(Math.max(aso.north - aso.south, aso.east - aso.west), 5);

  assert.equal(step, 3 / 60);
  assert.deepEqual(
    graticuleValues(aso.south, aso.north, step).map((value) => formatDms(value, 'lat', 'minutes')),
    ['32°48′N', '32°51′N', '32°54′N', '32°57′N'],
  );
  assert.deepEqual(
    graticuleValues(aso.west, aso.east, step).map((value) => formatDms(value, 'lon', 'minutes')),
    ['131°00′E', '131°03′E', '131°06′E', '131°09′E', '131°12′E'],
  );
});

void test('latitude fractions run from the north edge to the south edge', () => {
  assert.equal(latitudeFraction(aso, aso.north), 0);
  assert.equal(latitudeFraction(aso, aso.south), 1);
});

void test('scale bars pick 1/2/5 distances that fit the model', () => {
  assert.equal(pickScaleDistanceKm(10, 25), 10);
  assert.equal(pickScaleDistanceKm(5, 25), 5);
  assert.equal(pickScaleDistanceKm(2.4, 6), 2);
  assert.equal(pickScaleDistanceKm(0.8, 2), 1);
});

void test('preset locations are named and offset crops move the model center', () => {
  const centered = createFloorPlace({ latitude: 32.8842, longitude: 131.104 }, 0, 0, 25, 25);
  const custom = createFloorPlace({ latitude: 10, longitude: 20 }, 0, 0, 5, 5);
  const offset = createFloorPlace({ latitude: 32.8842, longitude: 131.104 }, 5, 5, 10, 10);

  assert.equal(centered.name, 'Mount Aso');
  assert.equal(centered.region, 'Japan');
  assert.deepEqual(centered.bounds, aso);
  assert.equal(custom.name, undefined);
  assert.ok(offset.latitude < 32.8842);
  assert.ok(offset.longitude > 131.104);
  assert.equal(offset.name, 'Mount Aso');
});
