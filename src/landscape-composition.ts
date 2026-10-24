import type { RealTerrain } from './real-terrain';
import { findTerrainSummits } from './summit-markers';
import type { ContourPoint } from './types/contours';
import { extractContours } from './contour-extraction';
import { deriveTerrainConfiguration } from './design-settings';
import { createTerrainSampler, sampleTerrain } from './terrain-generation';
import type { Contour } from './types/contours';
import type { DesignSettings } from './types/design';
import type { EngineConfiguration } from './types/terrain';

/** Spaces elevation levels across the stable engine bounds. */
export function calculateContourElevations(
  settings: Readonly<DesignSettings>,
  engineConfiguration: Readonly<EngineConfiguration>,
): number[] {
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
): { contours: Contour[]; summits: ContourPoint[] } {
  const terrainSettings = deriveTerrainConfiguration(settings, engineConfiguration);
  const field = sampleTerrain(
    realTerrain
      ? (x, y) => realTerrain.sample(x, y, settings.width, settings.height)
      : createTerrainSampler(settings.seed, terrainSettings),
    settings.width,
    settings.height,
    terrainSettings,
  );

  return {
    contours: extractContours(field, calculateContourElevations(settings, engineConfiguration)),
    summits: findTerrainSummits(field),
  };
}
