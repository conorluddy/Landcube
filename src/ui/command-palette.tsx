import { useEffect, useId, useRef } from 'react';
import { Button } from './button';
import { GlassPanel } from './glass-panel';
import { Kbd } from './kbd';

export type CommandResultKind = 'parameter' | 'location' | 'action';

export interface CommandResult {
  kind: CommandResultKind;
  /** Unique within `results`. */
  id: string;
  label: string;
  /** Group or section code (`CONT.03`), mono. */
  code?: string;
  /** Trailing text: a parameter's current value, a place's region. */
  detail?: string;
}

export interface CommandQuickValue {
  label: string;
  value: string;
}

/** The value diff (`20 M → 25 M`); `to` is absent until a new value is typed. */
export interface CommandPreview {
  label: string;
  from: string;
  to?: string;
  error?: string;
}

/** The dialog hosting the palette wears this class: a centred modal, or a bottom sheet on phones. */
export const commandPaletteDialogClassName = 'lc-command-palette-dialog';

export interface CommandPaletteProps {
  isOpen: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  /** Ordered so results of one kind are adjacent; each run renders as a captioned group. */
  results: readonly CommandResult[];
  /** Index into `results`, or -1. */
  activeIndex: number;
  onActivate: (index: number) => void;
  onSelect: (result: CommandResult) => void;
  onClose: () => void;
  isMobile?: boolean;
  quickValues?: readonly CommandQuickValue[];
  preview?: CommandPreview;
  /** Defined during a parameter's value step; the value field then takes focus. */
  valueDraft?: string;
  onValueDraftChange?: (draft: string) => void;
  /** Applies a typed draft or a quick value. */
  onApplyValue?: (value: string) => void;
  /** Search progress or "No matches", announced politely. */
  status?: string;
}

/**
 * Command palette (C-09): a combobox over grouped parameter, location and action results, with a
 * preview pane for the active result. Pure view: the host owns the dialog, ranking and applying.
 */
export function CommandPalette({
  isOpen,
  query,
  onQueryChange,
  results,
  activeIndex,
  onActivate,
  onSelect,
  onClose,
  isMobile = false,
  quickValues,
  preview,
  valueDraft,
  onValueDraftChange,
  onApplyValue,
  status,
}: CommandPaletteProps): React.JSX.Element | null {
  const baseId = useId();
  const listboxId = `${baseId}-results`;
  const listboxRef = useRef<HTMLDivElement>(null);
  const valueInputRef = useRef<HTMLInputElement>(null);
  const isValueStep = valueDraft !== undefined;

  useEffect(() => {
    if (isValueStep) {
      valueInputRef.current?.focus({ preventScroll: true });
    }
  }, [isValueStep]);
  useEffect(() => {
    listboxRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!isOpen) {
    return null;
  }

  const getOptionId = (index: number) => `${baseId}-option-${String(index)}`;

  const moveActive = (step: 1 | -1) => {
    if (results.length === 0) {
      return;
    }

    onActivate(
      activeIndex < 0 && step < 0
        ? results.length - 1
        : (activeIndex + step + results.length) % results.length,
    );
  };

  return (
    <GlassPanel
      padding="none"
      className="lc-command-palette"
      dataAttributes={{ 'data-layout': isMobile ? 'sheet' : 'modal' }}
    >
      <div className="lc-command-palette__search">
        <span className="lc-command-palette__glyph" aria-hidden="true">
          ⌘
        </span>
        <input
          className="lc-command-palette__input"
          type="text"
          role="combobox"
          aria-label="Find a command"
          aria-autocomplete="list"
          aria-expanded={results.length > 0}
          aria-controls={listboxId}
          aria-activedescendant={
            activeIndex >= 0 && activeIndex < results.length ? getOptionId(activeIndex) : undefined
          }
          autoComplete="off"
          spellCheck={false}
          placeholder="Parameter, place or action…"
          value={query}
          onChange={(event) => {
            onQueryChange(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              moveActive(event.key === 'ArrowDown' ? 1 : -1);
            } else if (event.key === 'Enter' && activeIndex >= 0 && activeIndex < results.length) {
              event.preventDefault();
              onSelect(results[activeIndex]);
            }
          }}
        />
        {isMobile ? (
          <Button variant="text" size="small" onClick={onClose}>
            Cancel
          </Button>
        ) : (
          <Kbd keys={['esc']} />
        )}
      </div>
      <div
        ref={listboxRef}
        id={listboxId}
        role="listbox"
        aria-label="Commands"
        className="lc-command-palette__results"
      >
        {groupAdjacentResults(results).map(({ kind, entries }, runIndex) => {
          const titleId = `${baseId}-group-${String(runIndex)}`;

          return (
            <div key={titleId} role="group" aria-labelledby={titleId}>
              <div id={titleId} role="presentation" className="lc-command-palette__group-title">
                {resultGroupTitles[kind]}
              </div>
              {entries.map(({ result, index }) => (
                <div
                  key={result.id}
                  id={getOptionId(index)}
                  role="option"
                  aria-selected={index === activeIndex}
                  className="lc-command-palette__option"
                  onMouseDown={(event) => {
                    // Keeps focus in the combobox so the click lands before any blur.
                    event.preventDefault();
                  }}
                  onMouseMove={() => {
                    if (index !== activeIndex) {
                      onActivate(index);
                    }
                  }}
                  onClick={() => {
                    onSelect(result);
                  }}
                >
                  <span className="lc-command-palette__code">{result.code}</span>
                  <span className="lc-command-palette__label">{result.label}</span>
                  {result.detail !== undefined && (
                    <span className="lc-command-palette__detail">{result.detail}</span>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div className="lc-command-palette__preview">
        <div aria-live="polite" className="lc-command-palette__readout">
          {preview !== undefined && (
            <>
              <p className="lc-command-palette__preview-label">{preview.label}</p>
              <p className="lc-command-palette__diff">
                <span>{preview.from}</span>
                {preview.to !== undefined && (
                  <>
                    <span className="lc-command-palette__arrow" role="img" aria-label="to">
                      →
                    </span>
                    <span className="lc-command-palette__to">{preview.to}</span>
                  </>
                )}
              </p>
              {preview.error !== undefined && (
                <p className="lc-command-palette__error">{preview.error}</p>
              )}
            </>
          )}
          {status !== undefined && <p className="lc-command-palette__status">{status}</p>}
        </div>
        {isValueStep && (
          <div className="lc-command-palette__value">
            <input
              ref={valueInputRef}
              className="lc-command-palette__value-input"
              type="text"
              aria-label={`New value for ${preview?.label ?? 'parameter'}`}
              autoComplete="off"
              spellCheck={false}
              value={valueDraft}
              onChange={(event) => {
                onValueDraftChange?.(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onApplyValue?.(valueDraft);
                }
              }}
            />
            <Button
              variant="primary"
              size="small"
              trailingGlyph="↵"
              onClick={() => {
                onApplyValue?.(valueDraft);
              }}
            >
              Set value
            </Button>
          </div>
        )}
        {quickValues !== undefined && quickValues.length > 0 && (
          <div role="group" aria-label="Quick values" className="lc-command-palette__quick">
            {quickValues.map((quickValue) => (
              <button
                key={quickValue.value}
                type="button"
                className="lc-command-palette__chip"
                onClick={() => {
                  onApplyValue?.(quickValue.value);
                }}
              >
                {quickValue.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {!isMobile && (
        <div className="lc-command-palette__hints" aria-hidden="true">
          <span className="lc-command-palette__hint">
            <Kbd keys={['↑', '↓']} /> Navigate
          </span>
          <span className="lc-command-palette__hint">
            <Kbd keys={['↵']} /> Select
          </span>
          <span className="lc-command-palette__hint">
            <Kbd keys={['esc']} /> Close
          </span>
        </div>
      )}
    </GlassPanel>
  );
}

// === HELPERS ===

const resultGroupTitles: Record<CommandResultKind, string> = {
  parameter: 'Parameters',
  location: 'Locations',
  action: 'Actions',
};

interface ResultRun {
  kind: CommandResultKind;
  entries: { result: CommandResult; index: number }[];
}

/** Splits `results` into runs of one kind, keeping each result's flat index for the active state. */
function groupAdjacentResults(results: readonly CommandResult[]): ResultRun[] {
  const runs: ResultRun[] = [];

  results.forEach((result, index) => {
    const last = runs.at(-1);

    if (last?.kind === result.kind) {
      last.entries.push({ result, index });
    } else {
      runs.push({ kind: result.kind, entries: [{ result, index }] });
    }
  });

  return runs;
}
