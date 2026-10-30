/*
 * Per-section control-group builders. Migrations #90–#93 add one file per section here
 * (e.g. `terrain.ts` exporting `buildTerrainGroups`) and list the builder below so
 * `registry.test.ts` checks its group ids against `src/studio/sections.ts`.
 */
import type { ControlGroupDefinition } from '../../ui/control-rows';
import type { InspectorSection, StudioController, StudioState } from '../controller';
import type { CropPreview } from '../crop-preview';
import { buildColourGroups } from './colour';
import { buildContourGroups } from './contours';
import { buildOverlayGroups } from './overlays';
import { buildRouteGroups } from './scene-route';
import { buildSceneGroups } from './scene';
import { buildCameraGroups, buildOrbitGroups } from './camera';
import { buildDirectorGroups } from './director';
import { buildFrameGroups } from './frame';
import { buildModelGroups } from './model';
import { buildTerrainGroups } from './terrain';

/**
 * Builds a section's groups from the current state. Pure apart from the callbacks it closes over:
 * it reads `state`, never calls `controller` while building, and omits groups hidden in this state
 * (their codes leave a gap). Each group id must be registered in `src/studio/sections.ts`.
 */
export type ControlGroupBuilder = (
  controller: StudioController,
  state: StudioState,
) => ControlGroupDefinition[];

export const controlGroupBuilders: readonly ControlGroupBuilder[] = [
  buildTerrainGroups,
  buildContourGroups,
  buildColourGroups,
  buildCameraGroups,
  buildOrbitGroups,
  buildDirectorGroups,
  buildSceneGroups,
  buildOverlayGroups,
  buildRouteGroups,
  buildModelGroups,
  buildFrameGroups,
];

/** The groups a section shows in this state; the inspector and pinned panels share them. */
export function buildSectionGroups(
  section: InspectorSection,
  controller: StudioController,
  state: StudioState,
  cropPreview?: CropPreview,
): ControlGroupDefinition[] {
  switch (section) {
    case 'Terrain':
      return buildTerrainGroups(controller, state);
    case 'Contours':
      return buildContourGroups(controller, state);
    case 'Colour':
      return buildColourGroups(controller, state);
    case 'Camera':
      return buildCameraGroups(controller, state);
    case 'Orbit':
      return buildOrbitGroups(controller, state);
    case 'Director':
      return buildDirectorGroups(controller, state);
    case 'Scene':
      return buildSceneGroups(controller, state);
    case 'Overlays':
      return buildOverlayGroups(controller, state);
    case 'Route':
      return buildRouteGroups(controller, state);
    case 'Model':
      return buildModelGroups(controller, state, cropPreview);
    case 'Frame':
      return buildFrameGroups(controller, state);
  }
}
