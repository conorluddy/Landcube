import {
  openMeteoSearchEndpoint,
  photonSearchEndpoint,
  placeSearchMaximumResponseBytes,
  placeSearchMinimumQueryLength,
  placeSearchResultLimit,
  placeSearchTimeoutMs,
} from './constants/place-search';
import { operationErrorCodes } from './constants/operations';
import { realTerrainBounds } from './constants/real-terrain';
import { createRequestSignal, readLimitedText } from './bounded-request';
import type { Result } from './types/operations';

export interface PlaceMatch {
  name: string;
  /** Region and country, for telling same-named places apart. */
  detail: string;
  latitude: number;
  longitude: number;
  provider: 'photon' | 'open-meteo';
}

/**
 * Places matching `query`, from Photon or, when Photon fails in a way a retry could fix, Open-Meteo.
 * Short queries resolve empty without a request; the caller's abort rejects instead of falling back.
 */
export async function searchPlaces(
  query: string,
  fetchPlaces: typeof fetch,
  signal?: AbortSignal,
): Promise<Result<PlaceMatch[]>> {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < placeSearchMinimumQueryLength) {
    return { ok: true, data: [] };
  }

  const photonUrl = `${photonSearchEndpoint}?${new URLSearchParams({
    q: trimmedQuery,
    limit: String(placeSearchResultLimit),
  })}`;
  const photon = await requestPlaces(photonUrl, parsePhotonPlaces, fetchPlaces, signal);

  if (photon.ok || !photon.error.retryable) {
    return photon;
  }

  const openMeteoUrl = `${openMeteoSearchEndpoint}?${new URLSearchParams({
    name: trimmedQuery,
    count: String(placeSearchResultLimit),
    format: 'json',
  })}`;

  return requestPlaces(openMeteoUrl, parseOpenMeteoPlaces, fetchPlaces, signal);
}

/** Photon answers GeoJSON, so each point is `[longitude, latitude]`. */
export function parsePhotonPlaces(response: unknown): Result<PlaceMatch[]> {
  if (!isRecord(response) || !Array.isArray(response.features)) {
    return failure('The place search response had no features. Retry later.');
  }

  const places: PlaceMatch[] = [];

  for (const feature of response.features) {
    if (!isRecord(feature) || !isRecord(feature.geometry) || !isRecord(feature.properties)) {
      continue;
    }

    const coordinates = feature.geometry.coordinates;
    const properties = feature.properties;

    if (!Array.isArray(coordinates) || typeof properties.name !== 'string') {
      continue;
    }

    addPlace(places, {
      name: properties.name,
      detail: joinDetail(properties.state, properties.country),
      latitude: coordinates[1],
      longitude: coordinates[0],
      provider: 'photon',
    });
  }

  return { ok: true, data: places };
}

/** Open-Meteo leaves out `results` when nothing matches. */
export function parseOpenMeteoPlaces(response: unknown): Result<PlaceMatch[]> {
  if (!isRecord(response)) {
    return failure('The place search response was not an object. Retry later.');
  }

  if (response.results === undefined) {
    return { ok: true, data: [] };
  }

  if (!Array.isArray(response.results)) {
    return failure('The place search results were not a list. Retry later.');
  }

  const places: PlaceMatch[] = [];

  for (const result of response.results) {
    if (!isRecord(result) || typeof result.name !== 'string') {
      continue;
    }

    addPlace(places, {
      name: result.name,
      detail: joinDetail(result.admin1, result.country),
      latitude: result.latitude,
      longitude: result.longitude,
      provider: 'open-meteo',
    });
  }

  return { ok: true, data: places };
}

// === HELPERS ===

/** Downloads and parses one provider's answer; every failure but the caller's abort is retryable. */
async function requestPlaces(
  url: string,
  parse: (response: unknown) => Result<PlaceMatch[]>,
  fetchPlaces: typeof fetch,
  signal: AbortSignal | undefined,
): Promise<Result<PlaceMatch[]>> {
  const request = createRequestSignal(placeSearchTimeoutMs, signal, 'The place search timed out.');

  try {
    const response = await fetchPlaces(url, { signal: request.signal });

    if (!response.ok) {
      await response.body?.cancel();

      return failure(`The place search service answered ${response.status}. Retry later.`);
    }

    const text = await readLimitedText(response, placeSearchMaximumResponseBytes);

    if (text === undefined) {
      return failure('The place search response was too large. Retry later.');
    }

    return parse(JSON.parse(text));
  } catch (error) {
    if (signal?.aborted === true) {
      throw error;
    }

    return request.signal.aborted
      ? failure('The place search timed out. Check your connection and retry.')
      : failure('Places could not be searched. Check your connection and retry.');
  } finally {
    request.release();
  }
}

/** Keeps places with finite coordinates that real terrain can load. */
function addPlace(
  places: PlaceMatch[],
  place: Omit<PlaceMatch, 'latitude' | 'longitude'> & { latitude: unknown; longitude: unknown },
): void {
  const { latitude, longitude } = place;

  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < realTerrainBounds.minimumLatitude ||
    latitude > realTerrainBounds.maximumLatitude ||
    longitude < realTerrainBounds.minimumLongitude ||
    longitude > realTerrainBounds.maximumLongitude
  ) {
    return;
  }

  places.push({ ...place, latitude, longitude });
}

function joinDetail(region: unknown, country: unknown): string {
  return [region, country]
    .filter((part): part is string => typeof part === 'string' && part !== '')
    .join(', ');
}

function failure(message: string): Result<PlaceMatch[]> {
  return {
    ok: false,
    error: { code: operationErrorCodes.placeSearchFailed, message, retryable: true },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
