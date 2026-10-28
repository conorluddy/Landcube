/** Komoot's public Photon geocoder over OpenStreetMap; tried first. */
export const photonSearchEndpoint = 'https://photon.komoot.io/api/';

/** Open-Meteo's GeoNames-backed geocoder; used when Photon is down or slow. */
export const openMeteoSearchEndpoint = 'https://geocoding-api.open-meteo.com/v1/search';

export const placeSearchResultLimit = 8;
export const placeSearchTimeoutMs = 5000;
export const placeSearchMaximumResponseBytes = 512 * 1024;
export const placeSearchMinimumQueryLength = 3;
export const placeSearchDebounceMs = 300;
export const cachedPlaceSearchLimit = 20;
export const placeSearchAttribution = 'Search © OpenStreetMap contributors / Open-Meteo';
