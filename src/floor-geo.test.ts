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

const asoSource = { location: { latitude: 32.8842, longitude: 131.104 }, spanKm: 30 };
const sourceFrame = { width: 30, height: 20 };

void test('a centered crop of a preset is named and shares the source center', () => {
  const place = createFloorPlace(
    { ...asoSource, spanKm: 25 },
    { x: 0, y: 0, width: 20, height: 20 },
    { width: 20, height: 20 },
  );

  assert.equal(place?.name, 'Mount Aso');
  assert.equal(place.region, 'Japan');
  assert.deepEqual(place.bounds, aso);
});

// 30 km across a 30-unit frame is 1 km per unit; the frame's north edge is 10 km north of center.
void test('an off-center, non-square crop prints the bounds of the cropped area', () => {
  const place = createFloorPlace(asoSource, { x: 20, y: 2, width: 8, height: 4 }, sourceFrame);

  assert.ok(place);
  assert.equal(place.widthKm, 8);
  assert.equal(place.lengthKm, 4);
  assert.ok(Math.abs(place.bounds.north - (32.8842 + 8 / 111.32)) < 1e-9);
  assert.ok(Math.abs(place.bounds.south - (32.8842 + 4 / 111.32)) < 1e-9);
  assert.equal(formatDms(place.bounds.north, 'lat'), '32°57′22″N');
  assert.equal(formatDms(place.bounds.south, 'lat'), '32°55′12″N');
  assert.equal(formatDms(place.bounds.west, 'lon'), '131°09′27″E');
  assert.equal(formatDms(place.bounds.east, 'lon'), '131°14′35″E');
  assert.equal(place.name, 'Mount Aso');
});

void test('custom locations have no name or region', () => {
  const place = createFloorPlace(
    { location: { latitude: 10, longitude: 20 }, spanKm: 5 },
    { x: 0, y: 0, width: 20, height: 20 },
    { width: 20, height: 20 },
  );

  assert.equal(place?.name, undefined);
  assert.equal(place?.region, undefined);
  assert.equal(place?.latitude, 10);
});

void test('sources without a location or a usable span have no floor place', () => {
  const crop = { x: 0, y: 0, width: 20, height: 20 };

  assert.equal(createFloorPlace(undefined, crop, sourceFrame), undefined);
  assert.equal(createFloorPlace({ spanKm: 30 }, crop, sourceFrame), undefined);

  for (const spanKm of [0, -5, NaN, Infinity]) {
    assert.equal(createFloorPlace({ ...asoSource, spanKm }, crop, sourceFrame), undefined);
  }

  assert.equal(createFloorPlace(asoSource, { ...crop, width: 0 }, sourceFrame), undefined);
});

void test('a searched place at the source center names the floor', () => {
  const place = createFloorPlace(
    { location: { latitude: 56.7969, longitude: -5.0035 }, spanKm: 10 },
    { x: 0, y: 0, width: 20, height: 20 },
    { width: 20, height: 20 },
    [
      {
        name: 'Ben Nevis',
        region: 'Scotland, United Kingdom',
        latitude: 56.7969,
        longitude: -5.0035,
      },
    ],
  );

  assert.equal(place?.name, 'Ben Nevis');
  assert.equal(place.region, 'Scotland, United Kingdom');
});
