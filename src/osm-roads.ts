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
import { createRequestSignal, readLimitedText } from './bounded-request';
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
  const request = createRequestSignal((overpassTimeoutSeconds + 5) * 1000, signal);

  try {
    return await requestMappedRoads(bounds, detail, fetchRoads, request.signal, signal, now);
  } finally {
    request.release();
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

  // Overpass reports timeouts and memory limits as 200 with partial elements and a remark;
  // accepting it would cache an incomplete network for the session.
  if (typeof response.remark === 'string' && response.remark !== '') {
    return failure(
      'The road service could not finish this area. Retry, or choose a smaller area span.',
      true,
    );
  }

  const roads: MappedRoad[] = [];
  const omitted: RoadNetwork['omitted'] = [];

  for (const element of response.elements) {
    const road = readRoadElement(element);

    if (road === undefined) {
      continue;
    }

    if (road.kind === 'road') {
      roads.push(road.road);
    } else {
      omitted.push({ roadClass: road.roadClass, kind: road.kind });
    }
  }

  return { ok: true, data: { roads, omitted, detail, fetchedAt, attribution: roadAttribution } };
}

// === HELPERS ===

/** Downloads and parses one road query; `requestSignal` also covers the caller's timeout. */
async function requestMappedRoads(
  bounds: GeoBounds,
  detail: RoadDetail,
  fetchRoads: typeof fetch,
  requestSignal: AbortSignal,
  signal: AbortSignal | undefined,
  now: () => Date,
): Promise<Result<RoadNetwork>> {
  let response: Response;

  try {
    response = await fetchRoads(overpassEndpoint, {
      method: 'POST',
      body: new URLSearchParams({ data: createOverpassRoadQuery(bounds, detail) }),
      signal: requestSignal,
    });
  } catch (error) {
    if (signal?.aborted === true) {
      throw error;
    }

    return requestSignal.aborted
      ? timedOut()
      : failure('Roads could not be downloaded. Check your connection and retry.', true);
  }

  if (!response.ok) {
    return failure(
      [429, 502, 503, 504].includes(response.status)
        ? 'The OpenStreetMap road service is busy. Wait a minute and retry.'
        : `The OpenStreetMap road service answered ${response.status}. Retry later.`,
      true,
    );
  }

  let text: string | undefined;

  try {
    text = await readLimitedText(response, overpassMaximumResponseBytes);
  } catch (error) {
    if (signal?.aborted === true) {
      throw error;
    }

    // Only the request's own timeout aborts it here, since the caller's abort rethrows above.
    return requestSignal.aborted
      ? timedOut()
      : failure('The road download was interrupted. Check your connection and retry.', true);
  }

  if (text === undefined) {
    return failure('This area has too many roads to draw. Choose a smaller area span.', false);
  }

  let json: unknown;

  try {
    json = JSON.parse(text);
  } catch {
    return failure('The road response was not valid JSON. Retry later.', true);
  }

  return parseOverpassRoads(json, detail, now().toISOString());
}

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

type ParsedRoadElement =
  { kind: 'tunnel' | 'bridge'; roadClass: RoadClass } | { kind: 'road'; road: MappedRoad };

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
    return { kind: 'tunnel', roadClass };
  }

  if (isTagSet(tags.bridge)) {
    return { kind: 'bridge', roadClass };
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

function timedOut(): Result<never> {
  return failure('The road service took too long. Retry, or choose a smaller area span.', true);
}

function failure(message: string, retryable: boolean): Result<never> {
  return { ok: false, error: { code: operationErrorCodes.mapDataFailed, message, retryable } };
}
