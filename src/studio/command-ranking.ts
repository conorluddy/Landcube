/*
 * Command palette ranking: a prefix match beats a word-start match beats a substring match, on
 * label, code or id, whichever scores best. Ties keep section order (01 TERR … 07 FRAM), then
 * index order. Pure; the palette host ranks on every keystroke.
 */
import type { CommandResultKind } from '../ui/command-palette';
import type { InspectorSection } from './controller';
import { studioSections } from './sections';

export interface RankableCommand {
  kind: CommandResultKind;
  id: string;
  label: string;
  code?: string;
  sectionId?: InspectorSection;
}

// === PUBLIC API ===

/** Commands matching `query`, best first. An empty query keeps every command in index order. */
export function rankCommands<T extends RankableCommand>(
  query: string,
  commands: readonly T[],
): T[] {
  const needle = query.trim().toLowerCase();

  if (needle === '') {
    return [...commands];
  }

  return commands
    .map((command, index) => ({ command, index, score: scoreCommand(needle, command) }))
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        getSectionOrder(a.command) - getSectionOrder(b.command) ||
        a.index - b.index,
    )
    .map(({ command }) => command);
}

/** Stable partition into parameters, then locations, then actions, as the palette groups them. */
export function groupCommandsByKind<T extends RankableCommand>(commands: readonly T[]): T[] {
  return commandKindOrder.flatMap((kind) => commands.filter((command) => command.kind === kind));
}

// === HELPERS ===

const commandKindOrder: readonly CommandResultKind[] = ['parameter', 'location', 'action'];

const matchScores = { prefix: 3, wordStart: 2, substring: 1, none: 0 } as const;

function scoreCommand(needle: string, command: RankableCommand): number {
  return Math.max(
    ...[command.label, command.code ?? '', command.id].map((field) => scoreField(needle, field)),
  );
}

function scoreField(needle: string, field: string): number {
  const haystack = field.toLowerCase();

  if (haystack.startsWith(needle)) {
    return matchScores.prefix;
  }

  if (splitWords(field).some((word) => word.startsWith(needle))) {
    return matchScores.wordStart;
  }

  return haystack.includes(needle) ? matchScores.substring : matchScores.none;
}

/** Words split on spaces, punctuation and camelCase humps: `indexStrokeWidth` → index stroke width. */
function splitWords(field: string): string[] {
  return field
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== '');
}

function getSectionOrder(command: RankableCommand): number {
  const section = studioSections.find(({ id }) => id === command.sectionId);

  return section?.index ?? studioSections.length + 1;
}
