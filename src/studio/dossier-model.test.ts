import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDesignParameters } from '../design-settings';
import type { RealTerrain } from '../real-terrain';
import { createStudioController, type StudioState } from './controller';
import { buildDossierModel } from './dossier-model';

const errigal: RealTerrain = {
  sample: () => 0,
  attribution:
    'Produced using Copernicus data and information funded by the European Union — EU-DEM layers',
  spanKm: 8,
  location: { latitude: 55.0343, longitude: -8.113 },
  contourInterval: 20,
  elevations: { minimumMeters: 11.6, maximumMeters: 750.8, originMeters: 380, metersPerUnit: 460 },
};
const generatedAt = new Date('2026-10-29T09:30:00.000Z');
const styleLink = 'https://landcu.be/?v=1&seed=123';

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
    getShareUrl: () => styleLink,
    copyLink: () => Promise.resolve({ ok: true, data: undefined }),
  }).getSnapshot();
}

void test('a procedural landscape is titled by seed and has no attribution', () => {
  const model = buildDossierModel(createState(), { styleLink, generatedAt });

  assert.equal(model.title, 'Seed 123');
  assert.equal(model.subtitle, 'Procedural landscape');
  assert.equal(model.generatedAt, '2026-10-29T09:30:00.000Z');
  assert.equal(model.attribution, null);
  assert.equal(model.roadsCredit, null);
  assert.equal(model.styleLink, styleLink);
  assert.equal(model.preview, undefined);
  assert.deepEqual(
    model.palette.map(({ label }) => label),
    ['Background', 'Lines'],
  );
  assert.ok(model.readouts.some(({ label, value }) => label === 'Seed' && value === '123'));
});

void test('real terrain carries its attribution verbatim and its coordinates', () => {
  const state = createState();
  const real: StudioState = {
    ...state,
    source: { ...state.source, selected: 'real', terrain: errigal },
  };
  const model = buildDossierModel(real, {
    styleLink,
    generatedAt,
    previewSrc: 'data:image/svg+xml,x',
  });
  const labels = model.readouts.map(({ label }) => label);

  assert.equal(model.attribution, errigal.attribution);
  assert.ok(model.subtitle.startsWith('Real terrain · '));
  assert.ok(labels.includes('Lat') && labels.includes('Span') && labels.includes('Contour'));
  assert.equal(model.preview?.src, 'data:image/svg+xml,x');
});

void test('the 3D view adds model size, height and frame, and drops camera angles', () => {
  const state = createState();
  const view3d: StudioState = {
    ...state,
    workspace: { ...state.workspace, view: '3d' },
    cameraPose: { azimuthDegrees: 312, elevationDegrees: 34, fovDegrees: 38 },
    metrics: { height: 38.2 },
    frame: { ...state.frame, settings: { ...state.frame.settings, preset: 'tray' } },
    scene: { ...state.scene, roads: { ...state.scene.roads, enabled: true } },
  };
  const model = buildDossierModel(view3d, { styleLink, generatedAt });
  const byLabel = new Map(model.readouts.map((cell) => [cell.label, cell]));

  assert.ok(byLabel.has('Model'));
  assert.equal(byLabel.get('Height')?.value, '38.20');
  assert.equal(byLabel.get('Frame')?.value, 'tray');
  assert.ok(!byLabel.has('Azimuth') && !byLabel.has('Elevation'));
  assert.equal(model.roadsCredit, 'Roads © OpenStreetMap contributors');
});
