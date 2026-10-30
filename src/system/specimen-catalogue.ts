import type { Specimen } from '../ui/specimens';
import type { CodedPart } from './registry.types';

/**
 * Every `src/ui` specimen, the same definitions `/specimens.html` and the screenshot suite use.
 * Eager inside the lazy system chunk, so the studio bundle never carries them.
 */
const specimenModules = import.meta.glob<{ default: Specimen[] }>(
  ['../ui/*.specimens.tsx', '../ui/overlays/*.specimens.tsx'],
  { eager: true },
);

export interface ComponentSpecimens {
  /** Repo path of the component file, e.g. 'src/ui/overlays/wipe.tsx'. */
  sourcePath: string;
  specimens: readonly Specimen[];
}

const specimensByComponent = new Map<string, ComponentSpecimens>(
  Object.entries(specimenModules).map(([modulePath, module]) => [
    module.default[0]?.component ?? modulePath,
    {
      sourcePath: modulePath.replace('../', 'src/').replace('.specimens.tsx', '.tsx'),
      specimens: module.default,
    },
  ]),
);

export function getComponentSpecimens(component: string): ComponentSpecimens {
  const found = specimensByComponent.get(component);

  if (!found) {
    throw new Error(
      `No specimens named "${component}". Check the defineSpecimens name in src/ui/${component}.specimens.tsx.`,
    );
  }

  return found;
}

/** How many plates a part shows: its specimens, or its drawn cells. */
export function countPlates(part: CodedPart): number {
  return part.kind === 'component'
    ? getComponentSpecimens(part.component).specimens.length
    : part.cells.length;
}
