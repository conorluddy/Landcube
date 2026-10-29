import { createSeaLevelGeometry, type SeaLevelGeometry } from './sea-level';
import type { RealTerrain } from './real-terrain';
import { findTerrainSummits } from './summit-markers';
import type { ContourPoint } from './types/contours';
import type { TerrainTerraceLevels } from './terrain-terraces';
import {
  getRealContourInterval,
  extractLandscapeContours,
  getRealContourElevations,
} from './real-terrain-contours';
import { deriveTerrainConfiguration } from './design-settings';
import { createTerrainSampler, resolveTerrainSampling, sampleTerrain } from './terrain-generation';
import type { Contour } from './types/contours';
import type { DesignSettings } from './types/design';
import type { EngineConfiguration } from './types/terrain';

/** Spaces elevation levels across the stable engine bounds. */
export function calculateContourElevations(
  settings: Readonly<DesignSettings>,
  engineConfiguration: Readonly<EngineConfiguration>,
  realTerrain?: RealTerrain,
): number[] {
  const realLevels = getRealContourElevations(realTerrain);

  if (realLevels) {
    return realLevels;
  }

  return Array.from(
    { length: settings.contourCount },
    (_, index) =>
      engineConfiguration.elevationMin +
      (index * (engineConfiguration.elevationMax - engineConfiguration.elevationMin)) /
        (settings.contourCount - 1),
  );
}

/** Builds settled geometry shared by preview and export. */
export function generateLandscapeContours(
  settings: Readonly<DesignSettings>,
  engineConfiguration: Readonly<EngineConfiguration>,
): Contour[] {
  return generateLandscapeGeometry(settings, engineConfiguration).contours;
}

/** Samples settled terrain once for contour paths and summit symbols. */
export function generateLandscapeGeometry(
  settings: Readonly<DesignSettings>,
  engineConfiguration: Readonly<EngineConfiguration>,
  realTerrain?: RealTerrain,
): { contours: Contour[]; summits: ContourPoint[]; seaLevel?: SeaLevelGeometry } {
  const terrainSettings = resolveTerrainSampling(
    deriveTerrainConfiguration(settings, engineConfiguration),
    realTerrain,
  );
  const field = sampleTerrain(
    realTerrain
      ? (x, y) => realTerrain.sample(x, y, settings.width, settings.height)
      : createTerrainSampler(settings.seed, terrainSettings),
    settings.width,
    settings.height,
    terrainSettings,
  );

  return {
    contours: extractLandscapeContours(
      field,
      calculateContourElevations(settings, engineConfiguration, realTerrain),
      realTerrain,
    ),
    summits: findTerrainSummits(field),
    seaLevel: createSeaLevelGeometry(field, settings.width, settings.height, realTerrain),
  };
}

/** Keeps terraces anchored to exactly the same physical or decorative contour levels. */
export function getTerrainTerraceLevels(
  settings: Readonly<DesignSettings>,
  engine: Readonly<EngineConfiguration>,
  terrain?: RealTerrain,
): TerrainTerraceLevels {
  const interval = getRealContourInterval(terrain);

  if (interval !== undefined && terrain?.elevations) {
    return {
      origin: -terrain.elevations.originMeters / terrain.elevations.metersPerUnit,
      interval: interval / terrain.elevations.metersPerUnit,
    };
  }

  return {
    origin: 0,
    interval: (engine.elevationMax - engine.elevationMin) / (settings.contourCount - 1),
  };
}
