import { bundledTerrainTileSources } from '../constants/bundled-terrain-tiles';
import { creditTerrainSources } from '../real-terrain';

/**
 * The data credit for `assets/terrain-plate.webp`, which is captured from the default location's
 * bundled tiles (see `scripts/capture-terrain-plate.ts`). Real-terrain output always credits its source.
 */
export const terrainPlateCredit = [
  ...new Set(Object.values(bundledTerrainTileSources).flatMap(creditTerrainSources)),
].join(' · ');
