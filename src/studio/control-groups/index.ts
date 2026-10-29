/*
 * Per-section control-group builders. Migrations #90–#93 add one file per section here
 * (e.g. `terrain.ts` exporting `buildTerrainGroups`) and list the builder below so
 * `registry.test.ts` checks its group ids against `src/studio/sections.ts`.
 */
import type { ControlGroupDefinition } from '../../ui/control-rows';
import type { StudioController, StudioState } from '../controller';
import { buildColourGroups } from './colour';
import { buildContourGroups } from './contours';
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
];
