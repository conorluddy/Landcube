import { hexToOklch } from '../color/oklch';
import { createFloorPlace } from '../floor-geo';
import { getRealContourInterval } from '../real-terrain-contours';
import type { SignalMarkKind } from '../ui/signal-mark';
import type { StudioState } from './controller';
import type { ElevationRangeMeters, MapLocation } from './hud-store';

/**
 * Pure view model for the HUD overlays: readout card contents, camera readouts, coordinate tip
 * lines, scale bar length and the canvas tone the marks are drawn against.
 */
export interface ReadoutCardModel {
  title: string;
  place: string;
  sourceLabel: string;
  signalKind: SignalMarkKind;
  cells: { label: string; value: string; unit?: string }[];
  attribution?: string;
}

export interface ScaleBarModel {
  totalKm: number;
  lengthPx: number;
}

export type CanvasTone = 'light' | 'dark';

/** Above this OKLCH lightness the canvas reads as light, so HUD marks switch to dark ink. */
const lightCanvasThreshold = 0.6;

// === PUBLIC API ===

export function describeTarget(
  state: StudioState,
  generatedRelief: ElevationRangeMeters | undefined,
): ReadoutCardModel {
  const { source, workspace } = state;
  const terrain = source.terrain;
  const signalKind = source.loading || workspace.activating ? 'live' : 'ok';
  const cameraCells = describeCameraCells(state);

  if (!terrain?.location || terrain.spanKm === undefined) {
    return {
      title: 'Procedural',
      place: `Seed ${state.design.seed}`,
      sourceLabel: 'Generated',
      signalKind,
      cells: [
        { label: 'Seed', value: String(state.design.seed) },
        { label: 'Contours', value: String(state.design.contourCount), unit: 'levels' },
        ...describeRangeCells(generatedRelief),
        ...cameraCells,
      ],
    };
  }

  const { location, spanKm } = terrain;
  const named = createFloorPlace(
    terrain,
    { x: 0, y: 0, width: 1, height: 1 },
    { width: 1, height: 1 },
    state.savedPlaces,
  );
  const [latitude, longitude] = formatMapLocation({ kind: 'geographic', ...location });
  const contourInterval = getRealContourInterval(terrain);
  const span = formatNumber(spanKm);

  return {
    title: named?.name ?? 'Real terrain',
    place: named?.region ?? `${latitude} ${longitude}`,
    sourceLabel: getTerrainSourceLabel(terrain.attribution),
    signalKind,
    cells: [
      { label: 'Lat', value: latitude },
      { label: 'Lon', value: longitude },
      { label: 'Span', value: `${span} × ${span}`, unit: 'km' },
      contourInterval === undefined
        ? { label: 'Contour', value: 'Density' }
        : { label: 'Contour', value: formatNumber(contourInterval), unit: 'm' },
      ...describeRangeCells(
        terrain.elevations && {
          minimum: Math.round(terrain.elevations.minimumMeters),
          maximum: Math.round(terrain.elevations.maximumMeters),
        },
      ),
      ...cameraCells,
    ],
    attribution: terrain.attribution,
  };
}

/** Readouts along the top of the HUD frame. */
export function describeCameraReadouts(state: StudioState): string[] {
  const pose = state.cameraPose;

  if (state.workspace.view === '2d' || pose === undefined) {
    return [`View ${state.workspace.view.toUpperCase()} · Plan`];
  }

  return [
    `View 3D · ${state.scene.rotating ? 'Turntable' : 'Orbit'}`,
    state.scene.camera.projection === 'orthographic' ? 'Ortho' : `FOV ${pose.fovDegrees}°`,
    `AZ ${pose.azimuthDegrees}°`,
    `EL ${pose.elevationDegrees}°`,
  ];
}

/** Right-hand HUD readout: the contour spacing the map is drawn at. */
export function describeContourReadout(state: StudioState): string {
  const interval = getRealContourInterval(state.source.terrain);

  return interval === undefined
    ? `${state.design.contourCount} levels`
    : `Contour ${formatNumber(interval)} m`;
}

/** Two tip lines: latitude and longitude, or metres east and south of the north-west corner. */
export function formatMapLocation(location: MapLocation): [string, string] {
  if (location.kind === 'local') {
    return [
      `E ${Math.round(location.eastMeters).toLocaleString('en')} m`,
      `S ${Math.round(location.southMeters).toLocaleString('en')} m`,
    ];
  }

  const { latitude, longitude } = location;

  return [
    `${Math.abs(latitude).toFixed(4)}°${latitude < 0 ? 'S' : 'N'}`,
    `${Math.abs(longitude).toFixed(4)}°${longitude < 0 ? 'W' : 'E'}`,
  ];
}

/** The longest 1, 2 or 5 × 10ⁿ km bar that fits `maximumLengthPx`. */
export function chooseScaleBar(metersPerPixel: number, maximumLengthPx: number): ScaleBarModel {
  const maximumKm = (maximumLengthPx * metersPerPixel) / 1000;
  const magnitude = 10 ** Math.floor(Math.log10(maximumKm));
  const step = [5, 2, 1].find((candidate) => candidate * magnitude <= maximumKm) ?? 1;
  const totalKm = Number((step * magnitude).toPrecision(1));

  return { totalKm, lengthPx: (totalKm * 1000) / metersPerPixel };
}

/** Whether the HUD draws over a light or a dark canvas; 3D shows the ground colour. */
export function getCanvasTone(state: StudioState): CanvasTone {
  const { scene, design, workspace } = state;
  const canvasColor =
    workspace.view === '3d' && scene.ground && !scene.groundMatch
      ? scene.groundColor
      : design.background;

  return hexToOklch(canvasColor).lightness > lightCanvasThreshold ? 'light' : 'dark';
}

/** Short names for the elevation sources credited in a real-terrain attribution. */
export function getTerrainSourceLabel(attribution: string): string {
  const names = terrainSourceNames
    .filter(([marker]) => attribution.includes(marker))
    .map(([, name]) => name);

  return names.length === 0 ? 'Terrarium' : names.join(' · ');
}

// === HELPERS ===

const terrainSourceNames: readonly [marker: string, name: string][] = [
  ['EU-DEM', 'EU-DEM'],
  ['U.S. Geological Survey', 'USGS'],
  ['ETOPO1', 'ETOPO1'],
  ['ArcticDEM', 'ArcticDEM'],
  ['Geoscience Australia', 'GA'],
  ['DGM', 'DGM AT'],
  ['Canada', 'CDEM'],
  ['INEGI', 'INEGI'],
  ['Land Information New Zealand', 'LINZ'],
  ['Kartverket', 'Kartverket'],
  ['Environment Agency', 'EA'],
];

function describeCameraCells(state: StudioState): ReadoutCardModel['cells'] {
  const pose = state.cameraPose;

  if (state.workspace.view !== '3d' || pose === undefined) {
    return [];
  }

  return [
    { label: 'Azimuth', value: `${pose.azimuthDegrees}°` },
    { label: 'Elevation', value: `${pose.elevationDegrees}°` },
  ];
}

function describeRangeCells(range: ElevationRangeMeters | undefined): ReadoutCardModel['cells'] {
  return [
    { label: 'Low', value: range === undefined ? '' : formatNumber(range.minimum), unit: 'm' },
    { label: 'High', value: range === undefined ? '' : formatNumber(range.maximum), unit: 'm' },
  ];
}

function formatNumber(value: number): string {
  return Number(value.toPrecision(4)).toLocaleString('en');
}
