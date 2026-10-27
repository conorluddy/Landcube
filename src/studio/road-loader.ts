import { roadSpanLimitsKm } from '../constants/roads';
import { operationErrorCodes } from '../constants/operations';
import { getAvailableRoadDetail, loadMappedRoads } from '../osm-roads';
import { getRealTerrainSourceBounds } from '../real-terrain-projection';
import type { RealTerrain } from '../real-terrain';
import type { Result } from '../types/operations';
import type { RoadNetwork } from '../types/roads';

type RoadPlacement = Required<Pick<RealTerrain, 'location' | 'spanKm'>>;

export interface RoadNetworkLoader {
  /** Resolves undefined when a newer request or `cancel` superseded this one. */
  load(placement: RoadPlacement): Promise<Result<RoadNetwork> | undefined>;
  cancel(): void;
}

/** One request at a time; each source patch is fetched at most once per session. */
export function createRoadNetworkLoader(fetchRoads: typeof fetch): RoadNetworkLoader {
  const cache = new Map<string, RoadNetwork>();
  let active: AbortController | undefined;

  return {
    async load(placement) {
      active?.abort();
      const key = getRoadPlacementKey(placement);
      const cached = cache.get(key);

      if (cached) {
        return { ok: true, data: cached };
      }

      const detail = getAvailableRoadDetail(placement.spanKm);

      if (detail === undefined) {
        return {
          ok: false,
          error: {
            code: operationErrorCodes.mapDataFailed,
            message: `Roads need an area of ${roadSpanLimitsKm.majorRoads} km or less.`,
            retryable: false,
          },
        };
      }

      const controller = new AbortController();

      active = controller;

      try {
        const result = await loadMappedRoads(
          getRealTerrainSourceBounds(placement),
          detail,
          fetchRoads,
          controller.signal,
        );

        if (result.ok) {
          cache.set(key, result.data);
        }

        return controller.signal.aborted ? undefined : result;
      } catch (error) {
        if (controller.signal.aborted) {
          return undefined;
        }

        throw error;
      }
    },
    cancel() {
      active?.abort();
      active = undefined;
    },
  };
}

/** Identifies the source patch a road network belongs to. */
export function getRoadPlacementKey(placement: RoadPlacement | undefined): string {
  return placement
    ? JSON.stringify([placement.location.latitude, placement.location.longitude, placement.spanKm])
    : '';
}
