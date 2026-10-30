/*
 * Section registry: index, 4-letter code and control-group ids, in design order (Camera before
 * Scene). A group's code is `CODE.NN`, NN being its 1-based position here. Positions are fixed
 * at registration, so a group hidden at runtime leaves a gap rather than renumbering the rest.
 *
 * `id` is today's `InspectorSection` value, not a slug: the inspector derives
 * `section#inspector-{id.toLowerCase()}[aria-label="{title} settings"]` and the rail button name
 * ("Model") from it, which the e2e tests bind to. Slug ↔ id: terrain ↔ 'Terrain',
 * contours ↔ 'Contours', colour ↔ 'Colour', camera ↔ 'Camera',
 * orbit ↔ 'Orbit', scene ↔ 'Scene', overlays ↔ 'Overlays', route ↔ 'Route', model ↔ 'Model',
 * frame ↔ 'Frame'. Export groups carry no code yet (open question on #88).
 */
import type { InspectorSection } from './controller';

export interface StudioSection {
  id: InspectorSection;
  /** 1-based display index: 01 TERR … 10 FRAM. */
  index: number;
  code: string;
  title: string;
  groupIds: readonly string[];
}

export const studioSections = [
  {
    id: 'Terrain',
    index: 1,
    code: 'TERR',
    title: 'Terrain',
    groupIds: ['autoplay', 'procedural-landscape', 'real-location'],
  },
  {
    id: 'Contours',
    index: 2,
    code: 'CONT',
    title: 'Contours',
    groupIds: ['contour-density', 'contour-appearance', 'index-contours', 'contours-3d'],
  },
  {
    id: 'Colour',
    index: 3,
    code: 'COLR',
    title: 'Colour',
    groupIds: [
      'palette',
      'materials',
      'land',
      'elevation-gradient',
      'water-material',
      'style-reset',
    ],
  },
  {
    id: 'Camera',
    index: 4,
    code: 'CAMR',
    title: 'Camera',
    groupIds: ['lens', 'focus', 'exposure'],
  },
  {
    id: 'Orbit',
    index: 5,
    code: 'ORBT',
    title: 'Orbit',
    groupIds: ['orbit'],
  },
  {
    id: 'Scene',
    index: 6,
    code: 'SCEN',
    title: 'Scene',
    groupIds: ['cursor-interaction', 'surface', 'grass', 'ground', 'water', 'lighting'],
  },
  {
    id: 'Overlays',
    index: 7,
    code: 'OVLY',
    title: 'Overlays',
    groupIds: ['decorative-grid', 'summit-markers', 'geographic-decorations', 'roads', 'sea-level'],
  },
  {
    id: 'Route',
    index: 8,
    code: 'ROUT',
    title: 'Route',
    groupIds: ['route'],
  },
  {
    id: 'Model',
    index: 9,
    code: 'MODL',
    title: 'Model',
    groupIds: ['model-dimensions', 'shape'],
  },
  {
    id: 'Frame',
    index: 10,
    code: 'FRAM',
    title: 'Frame',
    groupIds: ['frame', 'dimensions', 'edge'],
  },
] as const satisfies readonly StudioSection[];

export type ControlGroupId = (typeof studioSections)[number]['groupIds'][number];

// === PUBLIC API ===

/** `getGroupCode('index-contours') === 'CONT.03'`. Throws for an unregistered group id. */
export function getGroupCode(groupId: string): string {
  const { section, position } = findGroupPlacement(groupId);

  return `${section.code}.${String(position).padStart(2, '0')}`;
}

/** The section a group is registered under. Throws for an unregistered group id. */
export function getSectionForGroup(groupId: string): StudioSection {
  return findGroupPlacement(groupId).section;
}

/** True when `groupId` is registered; for callers that must not throw, such as tests. */
export function isRegisteredGroupId(groupId: string): groupId is ControlGroupId {
  return groupPlacements.has(groupId);
}

// === HELPERS ===

interface GroupPlacement {
  section: StudioSection;
  position: number;
}

const groupPlacements = indexGroupPlacements(studioSections);

function findGroupPlacement(groupId: string): GroupPlacement {
  const placement = groupPlacements.get(groupId);

  if (placement === undefined) {
    throw new Error(
      `Control group "${groupId}" is not registered. Add it to a section's groupIds in src/studio/sections.ts.`,
    );
  }

  return placement;
}

function indexGroupPlacements(sections: readonly StudioSection[]): Map<string, GroupPlacement> {
  const placements = new Map<string, GroupPlacement>();

  for (const section of sections) {
    section.groupIds.forEach((groupId, index) => {
      const existing = placements.get(groupId);

      if (existing !== undefined) {
        throw new Error(
          `Control group "${groupId}" is registered under both ${existing.section.code} and ${section.code}. Register each group once.`,
        );
      }

      placements.set(groupId, { section, position: index + 1 });
    });
  }

  return placements;
}
