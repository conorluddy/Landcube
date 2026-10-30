import type { CodedPart } from './registry.types';

export interface PartGroup {
  title: string;
  parts: readonly CodedPart[];
}

/** Case-insensitive substring match over name, summary, source, group and code. Blank finds nothing. */
export function findParts(parts: readonly CodedPart[], query: string): CodedPart[] {
  const needle = query.trim().toLowerCase();

  if (needle === '') {
    return [];
  }

  return parts.filter((part) =>
    [
      part.name,
      part.summary,
      part.kind === 'foundation' ? part.source : part.component,
      part.group,
      part.code,
    ]
      .join(' ')
      .toLowerCase()
      .includes(needle),
  );
}

/** The part `delta` steps from `id` in browse order, wrapping at both ends. */
export function stepPart(parts: readonly CodedPart[], id: string, delta: number): CodedPart {
  const index = Math.max(
    parts.findIndex((part) => part.id === id),
    0,
  );

  return parts[(((index + delta) % parts.length) + parts.length) % parts.length];
}

/** Consecutive runs of `key`, in order, e.g. the nav's groups within a section. */
export function groupParts(
  parts: readonly CodedPart[],
  key: (part: CodedPart) => string,
): PartGroup[] {
  const groups: { title: string; parts: CodedPart[] }[] = [];

  for (const part of parts) {
    const title = key(part);
    const last = groups.at(-1);

    if (last?.title === title) {
      last.parts.push(part);
    } else {
      groups.push({ title, parts: [part] });
    }
  }

  return groups;
}

/** '07' for 7: counts and positions across the nav, stage and footer. */
export function formatCount(value: number): string {
  return String(value).padStart(2, '0');
}
