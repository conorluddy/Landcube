import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  defaultTerrainLighting,
  formatTimeOfDay,
  getDaylightCycleLighting,
  getDaylightCyclePhase,
  getSuggestedTerrainLightDirection,
  getTerrainAtmosphere,
} from './terrain-lighting';

void test('the daylight cycle rises east, passes the equator side at noon and sets west', () => {
  const noonPhase = getDaylightCyclePhase(12);

  assert.equal(getDaylightCycleLighting(getDaylightCyclePhase(6)).direction, 90);
  assert.equal(getDaylightCycleLighting(noonPhase, 53).direction, 180);
  assert.equal(getDaylightCycleLighting(noonPhase, -33).direction, 0);
  assert.equal(getDaylightCycleLighting(getDaylightCyclePhase(18), -33).direction, 270);
});

void test('the daylight cycle spends most of its time in daylight and wraps through night', () => {
  assert.equal(getDaylightCycleLighting(0).timeOfDay, 5);
  assert.ok(Math.abs(getDaylightCycleLighting(0.85).timeOfDay - 21) < 1e-9);
  assert.ok(getDaylightCycleLighting(0.95).timeOfDay < 5);
  assert.equal(getDaylightCycleLighting(1).timeOfDay, 5);
});

void test('lighting defaults reveal natural materials and hemisphere suggestions use compass bearings', () => {
  assert.equal(defaultTerrainLighting.fill, 0.7);
  assert.equal(getSuggestedTerrainLightDirection(53), 120);
  assert.equal(getSuggestedTerrainLightDirection(-34), 60);
  assert.equal(getSuggestedTerrainLightDirection(0), 90);
  assert.equal(getSuggestedTerrainLightDirection(), defaultTerrainLighting.direction);
});

void test('the default time of day reproduces the original warm 35 degree sun', () => {
  const atmosphere = getTerrainAtmosphere(defaultTerrainLighting.timeOfDay);

  assert.equal(atmosphere.sunElevation, 35);
  assert.equal(atmosphere.sunColor, '#ffd09a');
  assert.equal(atmosphere.sunScale, 1);
  assert.equal(atmosphere.skyColor, '#e8f0ff');
  assert.equal(atmosphere.groundColor, '#36382c');
  assert.equal(atmosphere.tint, '#ffffff');
});

void test('night is moonlit and tints the studio dark and cool', () => {
  const night = getTerrainAtmosphere(2);

  assert.equal(night.label, 'Night');
  assert.equal(night.sunColor, '#a9c7ff');
  assert.ok(night.sunScale < 0.5);
  assert.equal(night.tint, '#3d4866');
});

void test('times between keyframes blend, and the day wraps past midnight', () => {
  const dusk = getTerrainAtmosphere(19.25);

  assert.ok(dusk.sunElevation > 6 && dusk.sunElevation < 10);
  assert.deepEqual(getTerrainAtmosphere(24), getTerrainAtmosphere(0));
  assert.deepEqual(getTerrainAtmosphere(23), getTerrainAtmosphere(-1));
});

void test('time of day reads as a clock time with a named light', () => {
  assert.equal(formatTimeOfDay(6.5), '06:30 · Golden hour');
  assert.equal(formatTimeOfDay(13), '13:00 · Midday');
  assert.equal(formatTimeOfDay(24), '00:00 · Night');
});
