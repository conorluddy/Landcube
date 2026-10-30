/*
 * GPX parsing for the route overlay. Platform-free: a small tolerant XML scanner instead of
 * DOMParser, so node tests and the CLI can share it. Reads `trk/trkseg/trkpt` (all segments
 * joined), `rte/rtept` and `wpt`; everything else is ignored. Input over 25 MB is refused.
 */
import { operationErrorCodes } from './constants/operations';
import type { GpxRoute, RoutePoint, RouteStats, RouteWaypoint } from './types/route';
import type { OperationError, Result } from './types/operations';

/** More points than this stalls the 3D ribbon build and the SVG overlay. */
export const maximumRoutePoints = 2000;
const maximumGpxCharacters = 25 * 1024 * 1024;
const earthRadiusMeters = 6371008.8;

// === PUBLIC API ===

export function parseGpx(text: string): Result<GpxRoute> {
  if (text.length > maximumGpxCharacters) {
    return fail(
      `GPX file is ${Math.round(text.length / 1048576)} MB; the limit is 25 MB. Export a shorter track.`,
    );
  }

  const root = buildElementTree(text);

  if (typeof root === 'string') {
    return fail(root);
  }

  if (root.name !== 'gpx') {
    return fail(`Expected a <gpx> document but found <${root.name}>. Choose a .gpx file.`);
  }

  const points: RoutePoint[] = [];
  const waypoints: RouteWaypoint[] = [];

  for (const element of root.children) {
    const problem =
      element.name === 'trk'
        ? collectPoints(
            element.children
              .filter(({ name }) => name === 'trkseg')
              .flatMap(childrenNamed('trkpt')),
            points,
          )
        : element.name === 'rte'
          ? collectPoints(childrenNamed('rtept')(element), points)
          : element.name === 'wpt'
            ? collectWaypoint(element, waypoints)
            : undefined;

    if (problem !== undefined) {
      return fail(problem);
    }
  }

  if (points.length < 2) {
    return fail(
      `GPX file has ${points.length} track or route points; a route needs at least 2. Export a track (<trk>) or route (<rte>).`,
    );
  }

  const name = findRouteName(root);

  return { ok: true, data: { ...(name === undefined ? {} : { name }), points, waypoints } };
}

/**
 * Douglas-Peucker on locally projected metres. Keeps the first and last point, and raises the
 * tolerance until the result fits `maximumRoutePoints`.
 */
export function simplifyRoute(
  points: readonly RoutePoint[],
  toleranceMeters: number,
): RoutePoint[] {
  if (points.length <= 2) {
    return [...points];
  }

  const projected = projectToLocalMeters(points);
  let tolerance = Math.max(0, toleranceMeters);
  let kept = keepSignificantPoints(projected, tolerance);

  while (kept.length > maximumRoutePoints) {
    tolerance = Math.max(1, tolerance * 2);
    kept = keepSignificantPoints(projected, tolerance);
  }

  return kept.map((index) => points[index]);
}

export function routeStats(points: readonly RoutePoint[]): RouteStats {
  let distanceMeters = 0;
  let ascentMeters = 0;
  let descentMeters = 0;
  let previousElevation: number | undefined;
  let hasElevationPair = false;

  for (const [index, point] of points.entries()) {
    if (index > 0) {
      distanceMeters += haversineMeters(points[index - 1], point);
    }

    const elevation = point.elevationMeters;

    if (elevation === undefined) {
      continue;
    }

    if (previousElevation !== undefined) {
      hasElevationPair = true;
      ascentMeters += Math.max(0, elevation - previousElevation);
      descentMeters += Math.max(0, previousElevation - elevation);
    }

    previousElevation = elevation;
  }

  return {
    distanceKm: distanceMeters / 1000,
    ...(hasElevationPair ? { ascentMeters, descentMeters } : {}),
    recordedPointCount: points.length,
  };
}

// === XML SCANNER ===

interface XmlElement {
  name: string;
  attributes: Record<string, string | undefined>;
  children: XmlElement[];
  text: string;
}

const tokenPattern =
  /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<![^>]*>|<(\/?)([A-Za-z_][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
const attributePattern = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/** The root element, or the reason the document is not well-formed. */
function buildElementTree(text: string): XmlElement | string {
  const stack: XmlElement[] = [];
  let root: XmlElement | undefined;
  let cursor = 0;

  for (const token of text.matchAll(tokenPattern)) {
    const current = stack.at(-1);

    appendText(current, text.slice(cursor, token.index));
    cursor = token.index + token[0].length;

    const [, cdata, closing, rawName, rawAttributes, selfClosing] = readGroups(token);

    if (cdata !== undefined) {
      appendText(current, cdata);
      continue;
    }

    if (rawName === undefined) {
      continue;
    }

    const name = stripNamespace(rawName);

    if (closing === '/') {
      if (current?.name !== name) {
        return `GPX file is not well-formed XML: </${rawName}> does not close ${current ? `<${current.name}>` : 'anything'}.`;
      }

      stack.pop();
      continue;
    }

    const element: XmlElement = {
      name,
      attributes: parseAttributes(rawAttributes ?? ''),
      children: [],
      text: '',
    };

    if (current) {
      current.children.push(element);
    } else if (root) {
      return 'GPX file is not well-formed XML: more than one root element.';
    } else {
      root = element;
    }

    if (selfClosing !== '/') {
      stack.push(element);
    }
  }

  if (!root) {
    return 'GPX file has no XML elements. Choose a .gpx file.';
  }

  if (stack.length > 0) {
    return `GPX file is not well-formed XML: <${stack.at(-1)?.name}> is never closed. The file may be truncated.`;
  }

  return root;
}

/** Optional regex groups are undefined at runtime; the match type hides that. */
function readGroups(match: RegExpMatchArray): (string | undefined)[] {
  return match;
}

function appendText(element: XmlElement | undefined, raw: string): void {
  if (element) {
    element.text += decodeEntities(raw);
  }
}

function parseAttributes(raw: string): Record<string, string | undefined> {
  const attributes: Record<string, string | undefined> = {};

  for (const match of raw.matchAll(attributePattern)) {
    const [, name = '', doubleQuoted, singleQuoted] = readGroups(match);

    attributes[stripNamespace(name)] = decodeEntities(doubleQuoted ?? singleQuoted ?? '');
  }

  return attributes;
}

function stripNamespace(name: string): string {
  return name.slice(name.indexOf(':') + 1);
}

const namedEntities: Readonly<Record<string, string | undefined>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decodeEntities(raw: string): string {
  return raw.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, body: string) => {
    const named = namedEntities[body.toLowerCase()];

    if (named !== undefined) {
      return named;
    }

    const isHex = body.charAt(1).toLowerCase() === 'x';
    const code = isHex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);

    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  });
}

// === GPX ELEMENTS ===

function childrenNamed(name: string): (element: XmlElement) => XmlElement[] {
  return (element) => element.children.filter((child) => child.name === name);
}

/** Appends points; returns an error message for the first invalid one. */
function collectPoints(elements: readonly XmlElement[], into: RoutePoint[]): string | undefined {
  for (const element of elements) {
    const coordinates = readCoordinates(element);

    if (typeof coordinates === 'string') {
      return coordinates;
    }

    const elevationMeters = readNumber(element.children.find(({ name }) => name === 'ele')?.text);

    into.push({
      ...coordinates,
      ...(elevationMeters === undefined ? {} : { elevationMeters }),
    });
  }

  return undefined;
}

function collectWaypoint(element: XmlElement, into: RouteWaypoint[]): string | undefined {
  const coordinates = readCoordinates(element);

  if (typeof coordinates === 'string') {
    return coordinates;
  }

  const name = element.children.find((child) => child.name === 'name')?.text.trim();

  into.push({
    name: name === undefined || name === '' ? `Waypoint ${into.length + 1}` : name,
    ...coordinates,
  });

  return undefined;
}

function readCoordinates(element: XmlElement): { latitude: number; longitude: number } | string {
  const latitude = readNumber(element.attributes.lat);
  const longitude = readNumber(element.attributes.lon);

  if (latitude === undefined || longitude === undefined) {
    return `<${element.name}> needs numeric lat and lon attributes; found lat="${element.attributes.lat ?? ''}" lon="${element.attributes.lon ?? ''}".`;
  }

  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return `<${element.name}> is outside the globe (lat ${latitude}, lon ${longitude}). Latitude must be within ±90 and longitude within ±180.`;
  }

  return { latitude, longitude };
}

function readNumber(text: string | undefined): number | undefined {
  if (text === undefined || text.trim() === '') {
    return undefined;
  }

  const value = Number(text);

  return Number.isFinite(value) ? value : undefined;
}

function findRouteName(root: XmlElement): string | undefined {
  for (const parent of ['metadata', 'trk', 'rte']) {
    const name = root.children
      .find((child) => child.name === parent)
      ?.children.find((child) => child.name === 'name')
      ?.text.trim();

    if (name !== undefined && name !== '') {
      return name;
    }
  }

  return undefined;
}

// === GEOMETRY ===

interface PlanarPoint {
  x: number;
  y: number;
}

/** Equirectangular around the mean latitude: exact enough at route scale. */
function projectToLocalMeters(points: readonly RoutePoint[]): PlanarPoint[] {
  const meanLatitude = points.reduce((sum, point) => sum + point.latitude, 0) / points.length;
  const metersPerDegree = (earthRadiusMeters * Math.PI) / 180;
  const longitudeScale = Math.cos((meanLatitude * Math.PI) / 180);

  return points.map((point) => ({
    x: point.longitude * metersPerDegree * longitudeScale,
    y: point.latitude * metersPerDegree,
  }));
}

/** Indices Douglas-Peucker keeps, ascending. Iterative, so long tracks cannot overflow the stack. */
function keepSignificantPoints(points: readonly PlanarPoint[], toleranceMeters: number): number[] {
  const isKept = new Uint8Array(points.length);
  const pending: [number, number][] = [[0, points.length - 1]];

  isKept[0] = 1;
  isKept[points.length - 1] = 1;

  while (pending.length > 0) {
    const [first, last] = pending.pop() ?? [0, 0];
    let farthestIndex = -1;
    let farthestDistance = toleranceMeters;

    for (let index = first + 1; index < last; index++) {
      const distance = distanceToSegment(points[index], points[first], points[last]);

      if (distance > farthestDistance) {
        farthestDistance = distance;
        farthestIndex = index;
      }
    }

    if (farthestIndex !== -1) {
      isKept[farthestIndex] = 1;
      pending.push([first, farthestIndex], [farthestIndex, last]);
    }
  }

  return Array.from(isKept.keys()).filter((index) => isKept[index] === 1);
}

function distanceToSegment(point: PlanarPoint, start: PlanarPoint, end: PlanarPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const fraction =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
        );

  return Math.hypot(point.x - (start.x + fraction * dx), point.y - (start.y + fraction * dy));
}

function haversineMeters(a: RoutePoint, b: RoutePoint): number {
  const toRadians = Math.PI / 180;
  const deltaLatitude = (b.latitude - a.latitude) * toRadians;
  const deltaLongitude = (b.longitude - a.longitude) * toRadians;
  const h =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(a.latitude * toRadians) *
      Math.cos(b.latitude * toRadians) *
      Math.sin(deltaLongitude / 2) ** 2;

  return 2 * earthRadiusMeters * Math.asin(Math.min(1, Math.sqrt(h)));
}

function fail(message: string): { ok: false; error: OperationError } {
  return {
    ok: false,
    error: { code: operationErrorCodes.invalidRoute, message, retryable: false },
  };
}
