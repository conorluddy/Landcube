import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { maximumRoutePoints, parseGpx, routeStats, simplifyRoute } from './gpx';
import type { GpxRoute, RoutePoint } from './types/route';

function readFixture(name: string): string {
  return readFileSync(new URL(`../tests/fixtures/${name}`, import.meta.url), 'utf8');
}

function parseValid(text: string): GpxRoute {
  const result = parseGpx(text);

  assert.ok(result.ok, result.ok ? '' : result.error.message);

  return result.data;
}

void test('a three-point track keeps its order, name and elevations', () => {
  const route = parseValid(readFixture('track.gpx'));

  assert.equal(route.name, 'Short & sweet');
  assert.deepEqual(route.points[1], { latitude: 55.02, longitude: -8.14, elevationMeters: 150 });
  assert.equal(route.points.length, 3);
  assert.deepEqual(route.waypoints, []);
});

void test('a route with waypoints reads rtepts and wpts', () => {
  const route = parseValid(readFixture('route.gpx'));

  assert.equal(route.name, 'Ridge walk');
  assert.equal(route.points.length, 4);
  assert.deepEqual(
    route.waypoints.map(({ name }) => name),
    ['Start hut', 'Summit'],
  );
});

void test('track segments are concatenated and unnamed waypoints get a number', () => {
  const route =
    parseValid(`<gpx><trk><trkseg><trkpt lat="1" lon="2"/><trkpt lat="1" lon="3"/></trkseg>
    <trkseg><trkpt lat="2" lon="3"/></trkseg></trk><wpt lat="1.5" lon="2.5"/></gpx>`);

  assert.equal(route.points.length, 3);
  assert.equal(route.waypoints[0].name, 'Waypoint 1');
});

void test('namespace prefixes, comments and CDATA names are tolerated', () => {
  const route = parseValid(`<?xml version="1.0"?><!-- hi --><g:gpx xmlns:g="x"><g:trk>
    <g:name><![CDATA[A <b> walk]]></g:name><g:trkseg><g:trkpt lat='1' lon='2'/><g:trkpt lat='1' lon='3'/>
    </g:trkseg></g:trk></g:gpx>`);

  assert.equal(route.name, 'A <b> walk');
  assert.equal(route.points.length, 2);
});

void test('malformed XML is an E-206 operation error that is not retryable', () => {
  const result = parseGpx(readFixture('malformed.gpx'));

  assert.ok(!result.ok);
  assert.equal(result.error.code, 'INVALID_ROUTE');
  assert.equal(result.error.retryable, false);
  assert.match(result.error.message, /not well-formed/);
});

void test('a file with no track or route points says what to export', () => {
  const result = parseGpx(readFixture('empty.gpx'));

  assert.ok(!result.ok);
  assert.match(result.error.message, /needs at least 2/);
});

void test('non-GPX documents, text and out-of-range coordinates are refused', () => {
  for (const text of [
    '<kml/>',
    'not xml at all',
    '',
    '<gpx><trk><trkseg><trkpt lat="91" lon="0"/><trkpt lat="0" lon="0"/></trkseg></trk></gpx>',
    '<gpx><trk><trkseg><trkpt lat="x" lon="0"/><trkpt lat="0" lon="0"/></trkseg></trk></gpx>',
  ]) {
    assert.ok(!parseGpx(text).ok, text);
  }
});

void test('simplifying drops collinear points and keeps the ends', () => {
  const line: RoutePoint[] = Array.from({ length: 50 }, (_, index) => ({
    latitude: 55 + index * 0.0001,
    longitude: -8,
  }));

  assert.deepEqual(simplifyRoute(line, 5), [line[0], line[49]]);
});

void test('simplifying keeps a real corner', () => {
  const corner: RoutePoint[] = [
    { latitude: 55, longitude: -8 },
    { latitude: 55.01, longitude: -8 },
    { latitude: 55.01, longitude: -7.99 },
  ];

  assert.equal(simplifyRoute(corner, 10).length, 3);
});

void test('simplifying caps a dense zigzag at the point limit', () => {
  const zigzag: RoutePoint[] = Array.from({ length: 10000 }, (_, index) => ({
    latitude: 55 + index * 0.00001,
    longitude: -8 + (index % 2) * 0.0003,
  }));

  assert.ok(simplifyRoute(zigzag, 0).length <= maximumRoutePoints);
});

void test('stats give distance, ascent and descent', () => {
  const stats = routeStats(parseValid(readFixture('track.gpx')).points);

  assert.ok(Math.abs(stats.distanceKm - 2.56) < 0.05, String(stats.distanceKm));
  assert.equal(stats.ascentMeters, 50);
  assert.equal(stats.descentMeters, 30);
  assert.equal(stats.recordedPointCount, 3);
});

void test('stats omit ascent when the file has no elevations', () => {
  const stats = routeStats([
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 0.01 },
  ]);

  assert.equal(stats.ascentMeters, undefined);
  assert.ok(Math.abs(stats.distanceKm - 1.112) < 0.01);
});
