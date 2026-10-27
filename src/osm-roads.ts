import {
  overpassEndpoint,
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

/** Overpass QL for every drawable way touching the bounds, with full geometry and tags. */
export function createOverpassRoadQuery(bounds: GeoBounds, detail: RoadDetail): string {
  const box = [bounds.south, bounds.west, bounds.north, bounds.east]
    .map((value) => value.toFixed(6))
    .join(',');

  return [
    `[out:json][timeout:${overpassTimeoutSeconds}];`,
    `way["highway"~"^(${roadDetailClasses[detail].join('|')})$"](${box});`,
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
      response.status === 429 || response.status === 504
        ? 'The OpenStreetMap road service is busy. Wait a minute and retry.'
        : `The OpenStreetMap road service answered ${response.status}. Retry later.`,
      true,
    );
  }

  try {
    return parseOverpassRoads(await response.json(), detail, now().toISOString());
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
