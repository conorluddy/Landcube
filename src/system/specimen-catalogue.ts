import type { Specimen } from '../ui/specimens';
import type { CodedPart, ComponentPart } from './registry.types';

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

/** The specimens a component part shows: its curated `plates` in order, or every specimen. */
export function getPartSpecimens(part: ComponentPart): readonly Specimen[] {
  const { specimens } = getComponentSpecimens(part.component);

  if (part.plates === undefined) {
    return specimens;
  }

  return part.plates.map((key) => {
    const specimen = specimens.find((candidate) => plateKey(candidate) === key);

    if (!specimen) {
      throw new Error(
        `Part "${part.id}" lists plate "${key}", which ${part.component}.specimens.tsx doesn't define.`,
      );
    }

    return specimen;
  });
}

/** How many plates a part shows: its (curated) specimens, or its drawn cells. */
export function countPlates(part: CodedPart): number {
  return part.kind === 'component' ? getPartSpecimens(part).length : part.cells.length;
}

/** 'primary/hover': a specimen's key without its component, as `plates` lists it. */
export function plateKey(specimen: Specimen): string {
  return [specimen.variant, specimen.size, specimen.state].filter(Boolean).join('/');
}
