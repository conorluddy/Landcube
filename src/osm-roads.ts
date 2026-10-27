import {
  overpassEndpoint,
  overpassMaximumResponseBytes,
  overpassTimeoutSeconds,
  roadAttribution,
  roadClasses,
  roadDetailClasses,
  roadSpanLimitsKm,
} from './constants/roads';
import { operationErrorCodes } from './constants/operations';
import type { GeoBounds } from './floor-geo';
import type { Result } from './types/operations';
import type { MappedRoad, RoadClass, RoadDetail, RoadNetwork } from './types/roads';

/** The finest road detail worth fetching for a source span; undefined when roads are unavailable. */
export function getAvailableRoadDetail(spanKm: number): RoadDetail | undefined {
  if (spanKm <= roadSpanLimitsKm.allRoads) {
    return 'tracks';
  }

  return spanKm <= roadSpanLimitsKm.majorRoads ? 'major' : undefined;
}

/**
 * Overpass QL for every drawable way touching the bounds, with full geometry and tags.
 * Bounds may run past ±180°; a patch across the antimeridian becomes one box on each side.
 */
export function createOverpassRoadQuery(bounds: GeoBounds, detail: RoadDetail): string {
  const filter = `way["highway"~"^(${roadDetailClasses[detail].join('|')})$"]`;
  const boxes = splitAtAntimeridian(bounds.west, bounds.east).map(([west, east]) =>
    [bounds.south, west, bounds.north, east].map((value) => value.toFixed(6)).join(','),
  );

  return [
    `[out:json][timeout:${overpassTimeoutSeconds}];`,
    `(${boxes.map((box) => `${filter}(${box});`).join(' ')});`,
    'out body geom qt;',
  ].join('\n');
}

/** Fetches mapped roads once per source; failures leave terrain untouched and say how to retry. */
export async function loadMappedRoads(
  bounds: GeoBounds,
  detail: RoadDetail,
  fetchRoads: typeof fetch,
  signal?: AbortSignal,
  now: () => Date = () => new Date(),
): Promise<Result<RoadNetwork>> {
  let response: Response;

  try {
    response = await fetchRoads(overpassEndpoint, {
      method: 'POST',
      body: new URLSearchParams({ data: createOverpassRoadQuery(bounds, detail) }),
      signal: AbortSignal.any([
        AbortSignal.timeout((overpassTimeoutSeconds + 5) * 1000),
        ...(signal ? [signal] : []),
      ]),
    });
  } catch (error) {
    if (signal?.aborted === true) {
      throw error;
    }

    return failure('Roads could not be downloaded. Check your connection and retry.', true);
  }

  if (!response.ok) {
    return failure(
      [429, 502, 503, 504].includes(response.status)
        ? 'The OpenStreetMap road service is busy. Wait a minute and retry.'
        : `The OpenStreetMap road service answered ${response.status}. Retry later.`,
      true,
    );
  }

  try {
    const text = await readLimitedText(response, overpassMaximumResponseBytes);

    if (text === undefined) {
      return failure('This area has too many roads to draw. Choose a smaller area span.', false);
    }

    return parseOverpassRoads(JSON.parse(text), detail, now().toISOString());
  } catch (error) {
    if (signal?.aborted === true) {
      throw error;
    }

    return failure('The road response was not valid JSON. Retry later.', true);
  }
}

/** Keeps drawable ways with at least two finite points; tunnels and bridges are counted, not drawn. */
export function parseOverpassRoads(
  response: unknown,
  detail: RoadDetail,
  fetchedAt: string,
): Result<RoadNetwork> {
  if (!isRecord(response) || !Array.isArray(response.elements)) {
    return failure('The road response had no elements. Retry later.', true);
  }

  const roads: MappedRoad[] = [];
  const omitted = { tunnels: 0, bridges: 0 };

  for (const element of response.elements) {
    const road = readRoadElement(element);

    if (road === undefined) {
      continue;
    }

    if (road.kind === 'road') {
      roads.push(road.road);
    } else if (road.kind === 'tunnel') {
      omitted.tunnels++;
    } else {
      omitted.bridges++;
    }
  }

  return { ok: true, data: { roads, omitted, detail, fetchedAt, attribution: roadAttribution } };
}

// === HELPERS ===

/** West-to-east longitude ranges inside ±180° that together cover `west`…`east`. */
function splitAtAntimeridian(west: number, east: number): [number, number][] {
  if (east - west >= 360) {
    return [[-180, 180]];
  }

  const wrappedWest = wrapLongitude(west);
  const wrappedEast = wrapLongitude(east);

  return wrappedWest <= wrappedEast
    ? [[wrappedWest, wrappedEast]]
    : [
        [wrappedWest, 180],
        [-180, wrappedEast],
      ];
}

function wrapLongitude(longitude: number): number {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}

/** Undefined once the body passes `maximumBytes`, without buffering the rest of it. */
async function readLimitedText(
  response: Response,
  maximumBytes: number,
): Promise<string | undefined> {
  if (Number(response.headers.get('content-length') ?? 0) > maximumBytes) {
    await response.body?.cancel();

    return undefined;
  }

  if (!response.body) {
    return response.text();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    totalBytes += chunk.value.byteLength;

    if (totalBytes > maximumBytes) {
      await reader.cancel();

      return undefined;
    }

    chunks.push(chunk.value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(bytes);
}

type ParsedRoadElement = { kind: 'tunnel' | 'bridge' } | { kind: 'road'; road: MappedRoad };

function readRoadElement(element: unknown): ParsedRoadElement | undefined {
  if (!isRecord(element) || element.type !== 'way' || typeof element.id !== 'number') {
    return undefined;
  }

  const tags = isRecord(element.tags) ? element.tags : {};
  const roadClass = tags.highway;

  if (!isRoadClass(roadClass) || !Array.isArray(element.geometry)) {
    return undefined;
  }

  if (isTagSet(tags.tunnel) || tags.covered === 'yes') {
    return { kind: 'tunnel' };
  }

  if (isTagSet(tags.bridge)) {
    return { kind: 'bridge' };
  }

  const points = element.geometry.flatMap((point) =>
    isRecord(point) && isLatitude(point.lat) && isLongitude(point.lon)
      ? [{ latitude: point.lat, longitude: point.lon }]
      : [],
  );

  // A dropped point would join its neighbours across a gap, so partial ways are skipped.
  if (points.length < 2 || points.length !== element.geometry.length) {
    return undefined;
  }

  return { kind: 'road', road: { id: element.id, roadClass, points } };
}

function isTagSet(value: unknown): boolean {
  return typeof value === 'string' && value !== 'no';
}

function isRoadClass(value: unknown): value is RoadClass {
  return roadClasses.some((roadClass) => roadClass === value);
}

function isLatitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 90;
}

function isLongitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 180;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function failure(message: string, retryable: boolean): Result<never> {
  return { ok: false, error: { code: operationErrorCodes.mapDataFailed, message, retryable } };
}
