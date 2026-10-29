/*
 * Studio side of the command palette: ranks the command index against `workspace.palette.query`,
 * searches places after three characters, and runs the chosen command. A parameter takes two
 * steps: the first Enter opens its value field, the second applies through the row's callback,
 * then the palette closes and the control is revealed.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { placeSearchDebounceMs, placeSearchMinimumQueryLength } from '../constants/place-search';
import type { PlaceMatch } from '../place-search';
import { CommandPalette, type CommandPreview } from '../ui/command-palette';
import {
  buildCommandIndex,
  buildLocationCommands,
  type ParameterCommand,
  type StudioCommand,
} from './command-index';
import { groupCommandsByKind, rankCommands } from './command-ranking';
import type { StudioController, StudioState } from './controller';

/** Enough to scan without scrolling far; locations are added on top. */
const maxRankedCommands = 40;

type LocationSearch =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'results'; places: PlaceMatch[] }
  | { kind: 'failed'; message: string };

type ValueStep = { commandId: string; draft: string; error?: string } | null;

// === PUBLIC API ===

/** ⌘K or Ctrl+K, unless the user is typing in a field where the keys mean something else. */
export function isCommandPaletteShortcut(event: KeyboardEvent): boolean {
  return (
    event.key.toLowerCase() === 'k' &&
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !isTextEntryTarget(event.target)
  );
}

export function CommandPaletteHost({
  controller: c,
  state,
  isMobile,
}: {
  controller: StudioController;
  state: StudioState;
  isMobile: boolean;
}): ReactNode {
  const query = state.workspace.palette?.query ?? '';
  const [activeIndex, setActiveIndex] = useState(0);
  const [valueStep, setValueStep] = useState<ValueStep>(null);
  const locationSearch = useLocationSearch(c, query);
  const index = useMemo(() => buildCommandIndex(c, state), [c, state]);
  const results = useMemo(
    () =>
      groupCommandsByKind<StudioCommand>([
        ...rankCommands(query, index).slice(0, maxRankedCommands),
        ...(locationSearch.kind === 'results' ? buildLocationCommands(locationSearch.places) : []),
      ]),
    [index, query, locationSearch],
  );
  const active = results.length === 0 ? -1 : Math.min(activeIndex, results.length - 1);
  const activeCommand = active < 0 ? undefined : results[active];
  const steppedCommand = index.find(
    (command): command is ParameterCommand =>
      command.kind === 'parameter' && command.id === valueStep?.commandId,
  );
  const previewedParameter =
    steppedCommand ?? (activeCommand?.kind === 'parameter' ? activeCommand : undefined);

  const close = () => {
    c.workspace({ palette: null });
  };

  const applyValue = (command: ParameterCommand, value: string) => {
    const result = command.apply(value);

    if (!result.ok) {
      setValueStep({ commandId: command.id, draft: value, error: result.error.message });

      return;
    }

    close();
    revealParameter(c, state, command, isMobile);
  };

  return (
    <CommandPalette
      isOpen
      isMobile={isMobile}
      query={query}
      onQueryChange={(nextQuery) => {
        setActiveIndex(0);
        setValueStep(null);
        c.workspace({ palette: { query: nextQuery } });
      }}
      results={results}
      activeIndex={active}
      // Hovering on the way to SET VALUE moves the highlight but keeps the open value step.
      onActivate={setActiveIndex}
      onSelect={(result) => {
        const command = results.find(({ id }) => id === result.id);

        if (command?.kind === 'parameter') {
          setValueStep({ commandId: command.id, draft: '' });
        } else if (command?.kind === 'location') {
          close();
          c.selectSection('Terrain');
          void c.loadSearchedPlace(command.match);
        } else if (command?.kind === 'action') {
          close();
          command.run();
        }
      }}
      onClose={close}
      quickValues={previewedParameter?.quickValues}
      preview={describePreview(previewedParameter, valueStep, activeCommand)}
      valueDraft={steppedCommand === undefined ? undefined : valueStep?.draft}
      onValueDraftChange={(draft) => {
        if (steppedCommand !== undefined) {
          setValueStep({ commandId: steppedCommand.id, draft });
        }
      }}
      onApplyValue={(value) => {
        if (previewedParameter !== undefined) {
          applyValue(previewedParameter, value);
        }
      }}
      status={describeStatus(query, results.length, locationSearch)}
    />
  );
}

// === HELPERS ===

function describePreview(
  parameter: ParameterCommand | undefined,
  valueStep: ValueStep,
  activeCommand: StudioCommand | undefined,
): CommandPreview | undefined {
  if (parameter !== undefined) {
    const draft = valueStep?.commandId === parameter.id ? valueStep.draft.trim() : '';

    return {
      label: parameter.label,
      from: parameter.current,
      to: draft === '' ? undefined : draft,
      error: valueStep?.commandId === parameter.id ? valueStep.error : undefined,
    };
  }

  return activeCommand?.kind === 'location'
    ? { label: activeCommand.label, from: activeCommand.coordinates }
    : undefined;
}

function describeStatus(
  query: string,
  resultCount: number,
  locationSearch: LocationSearch,
): string | undefined {
  if (locationSearch.kind === 'loading') {
    return 'Searching places…';
  }

  if (locationSearch.kind === 'failed') {
    return locationSearch.message;
  }

  return query.trim() !== '' && resultCount === 0 ? 'No matches.' : undefined;
}

/** Shows the edited control: its section (or the Overlays popover), scrolled into view. */
function revealParameter(
  c: StudioController,
  state: StudioState,
  command: ParameterCommand,
  isMobile: boolean,
): void {
  if (command.isInOverlays) {
    c.workspace({ popover: 'Overlays' });
  } else {
    c.selectSection(command.sectionId);

    if (isMobile && state.workspace.sheetSnap === 'peek') {
      c.workspace({ sheetSnap: 'half' });
    }
  }

  // The section renders on the next frame; only then is the control laid out.
  requestAnimationFrame(() => {
    document.getElementById(command.id)?.scrollIntoView({ block: 'nearest' });
  });
}

/** Debounced, superseding place search; queries under three characters search nothing. */
function useLocationSearch(c: StudioController, query: string): LocationSearch {
  const [search, setSearch] = useState<LocationSearch>({ kind: 'idle' });

  useEffect(() => {
    if (query.trim().length < placeSearchMinimumQueryLength) {
      setSearch({ kind: 'idle' });

      return;
    }

    let isCurrent = true;
    const timer = setTimeout(() => {
      setSearch({ kind: 'loading' });
      void c.searchPlaces(query).then((result) => {
        if (!isCurrent || result === undefined) {
          return;
        }

        setSearch(
          result.ok
            ? { kind: 'results', places: result.data }
            : { kind: 'failed', message: result.error.message },
        );
      });
    }, placeSearchDebounceMs);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [c, query]);

  return search;
}

const nonTextInputTypes = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement) {
    return !nonTextInputTypes.has(target.type);
  }

  return (
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}
