import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDesignParameters } from '../design-settings';
import type { RealTerrain } from '../real-terrain';
import { createStudioController, type StudioState } from './controller';
import {
  chooseScaleBar,
  describeCameraReadouts,
  describeSheetReadouts,
  describeTarget,
  formatMapLocation,
  getCanvasTone,
  getTerrainSourceLabel,
} from './hud-readouts';

const errigal: RealTerrain = {
  sample: () => 0,
  attribution:
    'Produced using Copernicus data and information funded by the European Union — EU-DEM layers',
  spanKm: 8,
  location: { latitude: 55.0343, longitude: -8.113 },
  contourInterval: 20,
  elevations: { minimumMeters: 11.6, maximumMeters: 750.8, originMeters: 380, metersPerUnit: 460 },
};

function createState(): StudioState {
  const parsed = parseDesignParameters(new URLSearchParams('v=1&seed=123'));

  assert.ok(parsed.ok);
  const design = parsed.data.settings;

  return createStudioController({
    getSettings: () => design,
    updateSettings: () => true,
    newLandscape: () => undefined,
    isSeedLocked: false,
    lockSeed: () => undefined,
    getShareUrl: () => '',
    copyLink: () => Promise.resolve({ ok: true, data: undefined }),
  }).getSnapshot();
}

function withRealTerrain(state: StudioState): StudioState {
  return { ...state, source: { ...state.source, selected: 'real', terrain: errigal } };
}

function in3d(state: StudioState): StudioState {
  return {
    ...state,
    workspace: { ...state.workspace, view: '3d' },
    cameraPose: { azimuthDegrees: 312, elevationDegrees: 34, fovDegrees: 38 },
  };
}

void test('the phone peek row shows seed, summit and contours, or summit, span and contour', () => {
  const procedural = describeSheetReadouts(describeTarget(createState(), undefined));
  const real = describeSheetReadouts(describeTarget(withRealTerrain(createState()), undefined));

  assert.deepEqual(
    procedural.map(({ label }) => label),
    ['Seed', 'High', 'Contours'],
  );
  assert.deepEqual(
    real.map(({ label, value }) => `${label} ${value}`),
    ['High 751', 'Span 8', 'Contour 20'],
  );
});

void test('procedural terrain reads as its seed, contour levels and nominal relief', () => {
  const target = describeTarget(createState(), { minimum: 120, maximum: 870 });

  assert.equal(target.title, 'Procedural');
  assert.equal(target.place, 'Seed 123');
  assert.equal(target.sourceLabel, 'Generated');
  assert.equal(target.attribution, undefined);
  assert.deepEqual(
    target.cells.map((cell) => [cell.label, cell.value]),
    [
      ['Seed', '123'],
      ['Contours', String(createState().design.contourCount)],
      ['Low', '120'],
      ['High', '870'],
    ],
  );
});

void test('real terrain names the preset and shows its source and full attribution', () => {
  const target = describeTarget(withRealTerrain(createState()), undefined);

  assert.equal(target.title, 'Errigal');
  assert.equal(target.sourceLabel, 'EU-DEM');
  assert.equal(target.attribution, errigal.attribution);
  assert.deepEqual(
    target.cells.map(
      (cell) => `${cell.label} ${cell.value}${cell.unit === undefined ? '' : ` ${cell.unit}`}`,
    ),
    ['Lat 55.0343°N', 'Lon 8.1130°W', 'Span 8 × 8 km', 'Contour 20 m', 'Low 12 m', 'High 751 m'],
  );
});

void test('the 3D view adds camera azimuth and elevation to the card and the frame', () => {
  const state = in3d(withRealTerrain(createState()));
  const cells = describeTarget(state, undefined).cells.slice(-2);

  assert.deepEqual(cells, [
    { label: 'Azimuth', value: '312°' },
    { label: 'Elevation', value: '34°' },
  ]);
  assert.deepEqual(describeCameraReadouts(state), [
    'View 3D · Orbit',
    'FOV 38°',
    'AZ 312°',
    'EL 34°',
  ]);
});

void test('a loading source pulses the card signal', () => {
  const state = createState();

  assert.equal(
    describeTarget({ ...state, source: { ...state.source, loading: true } }, undefined).signalKind,
    'live',
  );
});

void test('coordinate tips read hemisphere letters or metres from the north-west corner', () => {
  assert.deepEqual(formatMapLocation({ kind: 'geographic', latitude: -33.86, longitude: 151.2 }), [
    '33.8600°S',
    '151.2000°E',
  ]);
  assert.deepEqual(formatMapLocation({ kind: 'local', eastMeters: 4210.4, southMeters: 87 }), [
    'E 4,210 m',
    'S 87 m',
  ]);
});

void test('the scale bar picks the longest 1, 2 or 5 step that fits', () => {
  assert.deepEqual(chooseScaleBar(8000 / 1280, 272), { totalKm: 1, lengthPx: 160 });
  assert.deepEqual(chooseScaleBar(10, 272), { totalKm: 2, lengthPx: 200 });
  assert.deepEqual(chooseScaleBar(1, 120), { totalKm: 0.1, lengthPx: 100 });
});

void test('HUD marks follow the canvas: the dark 2D default and the light 3D ground', () => {
  const state = createState();

  assert.equal(getCanvasTone(state), 'dark');
  assert.equal(getCanvasTone(in3d(state)), 'light');
  assert.equal(getCanvasTone(in3d({ ...state, scene: { ...state.scene, ground: false } })), 'dark');
});

void test('source labels shorten every credited elevation source', () => {
  assert.equal(
    getTerrainSourceLabel(
      '3DEP, SRTM and GMTED2010 terrain data courtesy of the U.S. Geological Survey · ETOPO1: DOC/NOAA/NESDIS/NCEI, U.S. Department of Commerce',
    ),
    'USGS · ETOPO1',
  );
  assert.equal(getTerrainSourceLabel(''), 'Terrarium');
});
