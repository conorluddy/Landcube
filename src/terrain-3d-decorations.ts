import type * as THREE from 'three';
import { createTerrainGrassLayer, type TerrainGrassLayer } from './terrain-3d-grass';
import { createTerrainRockLayer, type TerrainRockLayer } from './terrain-3d-rocks';
import {
  getDecorationRoads,
  type DecorationGeography,
  type DecorationSite,
} from './decoration-field';
import { getFrameUnitsPerMm, type TerrainModelSettings } from './terrain-model';
import type { RockInstances } from './rock-placement';
import type { HeightField } from './types/terrain';
import type { RoadPath, RoadStyle } from './types/roads';

/** What decorations need from the last terrain update. */
export interface DecorationTerrain {
  field: HeightField;
  width: number;
  height: number;
  seaLevel: number | undefined;
  roadPaths: readonly RoadPath[];
  geography: DecorationGeography;
  exaggeration: number;
  elevationOffset: number;
}

/** Grass and rocks over one terrain, kept apart in the PRD's order: roads, then rocks, then grass. */
export interface TerrainDecorations {
  grass: TerrainGrassLayer;
  rocks: TerrainRockLayer;
  update(
    terrain: DecorationTerrain | undefined,
    modelSettings: TerrainModelSettings,
    roadStyle: Readonly<RoadStyle>,
    surface: THREE.BufferGeometry,
  ): void;
}

export function createTerrainDecorations(): TerrainDecorations {
  const grass = createTerrainGrassLayer();
  const rocks = createTerrainRockLayer();
  // Stable lists keep layers from re-placing or resurveying on unrelated updates.
  let roads: { key: readonly unknown[]; value: DecorationSite['roads'] } = { key: [], value: [] };
  let grassClearances: { key: readonly unknown[]; value: DecorationSite['roads'] } = {
    key: [],
    value: [],
  };

  return {
    grass,
    rocks,
    update(terrain, modelSettings, roadStyle, surface) {
      if (!terrain) {
        rocks.update(undefined);
        grass.update(undefined);

        return;
      }

      const { field, width, height, seaLevel, roadPaths, geography } = terrain;
      const frameUnitsPerMm = getFrameUnitsPerMm(width, height, modelSettings);
      const roadKey = [
        roadPaths,
        roadStyle.enabled,
        roadStyle.detail,
        roadStyle.widthMm,
        frameUnitsPerMm,
      ];

      if (!sameKey(roadKey, roads.key)) {
        roads = { key: roadKey, value: getDecorationRoads(roadPaths, roadStyle, frameUnitsPerMm) };
      }

      const site: DecorationSite = {
        field,
        width,
        height,
        shape: modelSettings.cropShape ?? 'rectangle',
        frameUnitsPerMm,
        seaLevel,
        roads: roads.value,
        ...geography,
      };

      rocks.update({
        site,
        exaggeration: terrain.exaggeration,
        elevationOffset: terrain.elevationOffset,
      });

      const placed = rocks.getInstances();
      const clearanceKey = [roads.value, placed];

      if (!sameKey(clearanceKey, grassClearances.key)) {
        grassClearances = {
          key: clearanceKey,
          value: placed
            ? [...roads.value, ...getRockClearances(placed, frameUnitsPerMm)]
            : roads.value,
        };
      }

      grass.update({ site: { ...site, roads: grassClearances.value }, surface });
    },
  };
}

// === HELPERS ===

/** Each rock as a zero-length road its own width, so grass leaves bare ground beneath it. */
function getRockClearances(
  instances: RockInstances,
  frameUnitsPerMm: number,
): DecorationSite['roads'] {
  return Array.from({ length: instances.count }, (_, index) => {
    const point = { x: instances.x[index], y: instances.y[index] };

    // Road reach is 1.4 × the half-width; rocks clear a touch less than their radius.
    return {
      points: [point, point],
      halfWidth: (instances.sizeMm[index] * frameUnitsPerMm * 0.45) / 1.4,
    };
  });
}

function sameKey(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
