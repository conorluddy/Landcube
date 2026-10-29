import type { ModelDossierView } from './model-dossier';

const previewImage =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='480' height='320'><rect width='480' height='320' fill='%23202326'/><path d='M0 220 C120 120 240 260 480 100' stroke='%23f2f2f0' fill='none'/></svg>";

const palette = [
  { label: 'Background', color: '#202326' },
  { label: 'Lines', color: '#f2f2f0' },
];

export const dossierTerrainAttribution =
  'Produced using Copernicus data and information funded by the European Union — EU-DEM layers';

export function createProceduralDossierFixture(
  overrides: Partial<ModelDossierView> = {},
): ModelDossierView {
  return {
    title: 'Seed 123',
    subtitle: 'Procedural landscape',
    generatedAt: '2026-10-29T09:30:00.000Z',
    readouts: [
      { label: 'Seed', value: '123' },
      { label: 'Contours', value: '24', unit: 'levels' },
      { label: 'Low', value: '0', unit: 'm' },
      { label: 'High', value: '412', unit: 'm' },
    ],
    styleLink: 'https://landcu.be/?v=1&seed=123&contourCount=24&background=%23202326',
    attribution: null,
    roadsCredit: null,
    preview: { src: previewImage, alt: 'Preview of Seed 123' },
    palette,
    ...overrides,
  };
}

export function createRealDossierFixture(
  overrides: Partial<ModelDossierView> = {},
): ModelDossierView {
  return createProceduralDossierFixture({
    title: 'Errigal',
    subtitle: 'Real terrain · Donegal, Ireland',
    readouts: [
      { label: 'Lat', value: '55.0343°N' },
      { label: 'Lon', value: '8.1130°W' },
      { label: 'Span', value: '8 × 8', unit: 'km' },
      { label: 'Contour', value: '20', unit: 'm' },
      { label: 'Low', value: '12', unit: 'm' },
      { label: 'High', value: '751', unit: 'm' },
    ],
    attribution: dossierTerrainAttribution,
    ...overrides,
  });
}

export function createModelDossierFixture(): ModelDossierView {
  return createRealDossierFixture({
    readouts: [
      ...createRealDossierFixture().readouts,
      { label: 'Model', value: '150 × 150', unit: 'mm' },
      { label: 'Height', value: '38.20', unit: 'mm' },
      { label: 'Frame', value: 'tray' },
    ],
    roadsCredit: 'Roads © OpenStreetMap contributors',
  });
}
