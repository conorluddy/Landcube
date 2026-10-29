import type { TerrainConfiguration, TerrainDetail } from '../types/terrain';

export const terrainDetailLevels = [
  'standard',
  'high',
  'max',
] as const satisfies readonly TerrainDetail[];

/** New real-terrain designs start here; configurations without the field keep `standard`. */
export const defaultNewTerrainDetail: TerrainDetail = 'high';

/** Terrarium tiles stop at zoom 15; zoom 16 requests return 404. */
export const maximumTerrainTileZoom = 15;

/** Concurrent tile requests per load, keeping use of the free tile host polite. */
export const maximumConcurrentTileRequests = 6;

export interface TerrainDetailProfile {
  sampling: Pick<TerrainConfiguration, 'sampleSpacing' | 'maxSamples'>;
  /** Minimum source pixels per sample across the visible span. */
  sourcePixelsPerSample: number;
  /** Tile limits per load; zoom steps down until the area fits. */
  tileBudget: { browser: number; node: number };
  /** Contour simplification tolerance in frame units. */
  simplifyTolerance: number;
}

/** Standard keeps version-one sampling and tile zoom exactly, so it has no profile. */
export const terrainDetailProfiles: Readonly<
  Record<Exclude<TerrainDetail, 'standard'>, TerrainDetailProfile>
> = {
  high: {
    sampling: { sampleSpacing: 2.5, maxSamples: 2_000_000 },
    sourcePixelsPerSample: 1,
    tileBudget: { browser: 64, node: 64 },
    simplifyTolerance: 0.25,
  },
  max: {
    sampling: { sampleSpacing: 1.25, maxSamples: 8_000_000 },
    sourcePixelsPerSample: 2,
    tileBudget: { browser: 144, node: 400 },
    simplifyTolerance: 0.25,
  },
};

/** Undefined for `standard`, which follows the version-one pipeline unchanged. */
export function getTerrainDetailProfile(
  detail: TerrainDetail | undefined,
): TerrainDetailProfile | undefined {
  return detail === undefined || detail === 'standard' ? undefined : terrainDetailProfiles[detail];
}

export function isTerrainDetail(value: unknown): value is TerrainDetail {
  return terrainDetailLevels.some((level) => level === value);
}
