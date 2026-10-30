import type { ReactNode } from 'react';

export type SpecimenState = 'default' | 'hover' | 'focus' | 'active' | 'disabled' | (string & {});

export interface Specimen {
  component: string;
  variant: string;
  size?: string;
  state?: SpecimenState;
  title?: string;
  render: () => ReactNode;
  /** Container width in CSS pixels, for narrow-container cases. */
  width?: number;
}

export type SpecimenEntry = Omit<Specimen, 'component'>;

/** Fills `component` and throws on duplicate component/variant/size/state keys. */
export function defineSpecimens(component: string, entries: SpecimenEntry[]): Specimen[] {
  const specimens = entries.map((entry) => ({ ...entry, component }));
  const seenKeys = new Set<string>();

  for (const specimen of specimens) {
    const key = specimenKey(specimen);

    if (seenKeys.has(key)) {
      throw new Error(
        `Duplicate specimen "${key}". Give each ${component} entry a distinct variant, size or state.`,
      );
    }

    seenKeys.add(key);
  }

  return specimens;
}

/** The `data-specimen` value: component/variant/size/state with missing segments omitted. */
export function specimenKey(specimen: Specimen): string {
  return [specimen.component, specimen.variant, specimen.size, specimen.state]
    .filter((segment): segment is string => Boolean(segment))
    .join('/');
}
