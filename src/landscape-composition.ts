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
  const terrainSettings = deriveTerrainConfiguration(settings, engineConfiguration);
  const field = sampleTerrain(
    createTerrainSampler(settings.seed, terrainSettings),
    settings.width,
    settings.height,
    terrainSettings,
  );
  return extractContours(field, calculateContourElevations(settings, engineConfiguration));
}
