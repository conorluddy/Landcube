import { componentParts } from './parts/components';
import { foundationParts } from './parts/foundations';
import { layoutParts } from './parts/layouts';
import type { CodedPart, SystemPart, SystemSection, SystemSectionId } from './registry.types';

/** Rail order. */
export const systemSections: readonly SystemSection[] = [
  section(1, 'FNDN', 'Foundations'),
  section(2, 'PRIM', 'Primitives'),
  section(3, 'COMP', 'Composites'),
  section(4, 'OVLY', 'Map overlays'),
  section(5, 'LYOT', 'Layouts'),
];

/** Every part in browse order, coded per section in that order (`PRIM.04`). */
export const systemParts: readonly CodedPart[] = assignCodes([
  ...foundationParts,
  ...componentParts,
  ...layoutParts,
]);

export function findPartById(id: string): CodedPart | undefined {
  return systemParts.find((part) => part.id === id);
}

/** Accepts the code case-insensitively, for hand-typed `?part=` links. */
export function findPartByCode(code: string): CodedPart | undefined {
  const wanted = code.toUpperCase();

  return systemParts.find((part) => part.code === wanted);
}

// === HELPERS ===

function section(index: number, id: SystemSectionId, title: string): SystemSection {
  return { id, index, code: id, title, shortTitle: id };
}

function assignCodes(parts: SystemPart[]): CodedPart[] {
  const countBySection = new Map<SystemSectionId, number>();

  return parts.map((part) => {
    const position = (countBySection.get(part.section) ?? 0) + 1;

    countBySection.set(part.section, position);

    return { ...part, code: `${part.section}.${String(position).padStart(2, '0')}` };
  });
}
