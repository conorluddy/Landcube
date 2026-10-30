/*
 * GPX 1.1 serialisation for the active route. Platform-free and deterministic: fixed coordinate
 * precision, no timestamps. Drawn routes carry terrain elevations only where covered; imported
 * routes re-export exactly what the device recorded and never borrow terrain heights.
 */
import type { RoutePoint } from './types/route';
import type { ActiveRoute, GeoPoint } from './types/terrain-analysis';

/** Narrowest terrain input: wrap `sampler.sampleMeters` in an arrow to satisfy this. */
export type TerrainElevationLookup = (point: GeoPoint) => number | undefined;

const coordinateDecimals = 7;
const terrainElevationDecimals = 1;

// === PUBLIC API ===

export function serializeRouteGpx(
  route: ActiveRoute,
  lookupElevation?: TerrainElevationLookup,
): string {
  const trackPoints: string[] =
    route.provenance === 'imported'
      ? (route.originalPoints ?? route.waypoints).map((point) =>
          // String() prints the shortest text that parses back to the identical number.
          formatTrackPoint(point, (point as RoutePoint).elevationMeters, String),
        )
      : route.waypoints.map((point) =>
          formatTrackPoint(point, lookupElevation?.(point), (value) =>
            formatFixed(value, terrainElevationDecimals),
          ),
        );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="LANDCU.BE" xmlns="http://www.topografix.com/GPX/1/1">',
    `  <metadata><name>${escapeXml(route.name)}</name></metadata>`,
    ...route.namedWaypoints.map(
      (waypoint) =>
        `  <wpt${coordinateAttributes(waypoint)}><name>${escapeXml(waypoint.name)}</name></wpt>`,
    ),
    '  <trk>',
    `    <name>${escapeXml(route.name)}</name>`,
    '    <trkseg>',
    ...trackPoints,
    '    </trkseg>',
    '  </trk>',
    '</gpx>',
    '',
  ].join('\n');
}

export function getRouteGpxFilename(route: Pick<ActiveRoute, 'name'>): string {
  const slug = route.name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${slug === '' ? 'route' : slug}.gpx`;
}

// === HELPERS ===

function formatTrackPoint(
  point: GeoPoint | RoutePoint,
  elevation: number | undefined,
  formatElevation: (value: number) => string,
): string {
  const attributes = coordinateAttributes(point);

  return elevation === undefined || !Number.isFinite(elevation)
    ? `      <trkpt${attributes}/>`
    : `      <trkpt${attributes}><ele>${formatElevation(elevation)}</ele></trkpt>`;
}

function coordinateAttributes(point: { latitude: number; longitude: number }): string {
  return ` lat="${formatFixed(point.latitude, coordinateDecimals)}" lon="${formatFixed(point.longitude, coordinateDecimals)}"`;
}

/** Avoids "-0.0000000" for tiny negatives so equal places always print equally. */
function formatFixed(value: number, decimals: number): string {
  const text = value.toFixed(decimals);

  return /^-0(\.0+)?$/.test(text) ? text.slice(1) : text;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
