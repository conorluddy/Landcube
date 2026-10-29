import type { Specimen } from '../ui/specimens';
import { specimenKey } from '../ui/specimens';

// Later components add `src/ui/<name>.specimens.tsx`; no edit needed here.
const modules = import.meta.glob<{ default: Specimen[] }>(
  ['../ui/*.specimens.tsx', '../ui/overlays/*.specimens.tsx'],
  {
    eager: true,
  },
);
const allSpecimens = Object.values(modules).flatMap((module) => module.default);
const forceableStates = ['hover', 'focus', 'active'];

export function Catalogue({ only }: { only: string | null }): React.JSX.Element {
  const visible =
    only !== null ? allSpecimens.filter((specimen) => specimen.component === only) : allSpecimens;

  return (
    <main className="specimens">
      {groupByComponent(visible).map(([component, specimens]) => (
        <section key={component}>
          <h2>{component}</h2>
          <div className="specimens__grid">
            {specimens.map((specimen) => (
              <SpecimenArticle key={specimenKey(specimen)} specimen={specimen} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}

function SpecimenArticle({ specimen }: { specimen: Specimen }): React.JSX.Element {
  const forcedState = forceableStates.includes(specimen.state ?? '') ? specimen.state : undefined;

  return (
    <article
      data-specimen={specimenKey(specimen)}
      data-force-state={forcedState}
      style={specimen.width !== undefined ? { width: specimen.width } : undefined}
    >
      {specimen.render()}
    </article>
  );
}

function groupByComponent(specimens: Specimen[]): [string, Specimen[]][] {
  const groups = new Map<string, Specimen[]>();

  for (const specimen of specimens) {
    groups.set(specimen.component, [...(groups.get(specimen.component) ?? []), specimen]);
  }

  return [...groups];
}
