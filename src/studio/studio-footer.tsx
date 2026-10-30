import { useSyncExternalStore, type ReactNode, type Ref } from 'react';
import { roadAttributionUrl } from '../constants/roads';
import { BarGroup, FloatingBar } from '../ui/floating-bar';
import { Button } from '../ui/button';
import { IconButton } from '../ui/icon-button';
import { SignalMark } from '../ui/signal-mark';
import { areRoadsDrawn, type StudioController, type StudioState } from './controller';
import { applyTheme, currentTheme, subscribeToTheme } from './theme';

/**
 * Phone status line inside the bottom sheet's peek row: live status, then the "Data sources"
 * disclosure that keeps real-terrain and road credits reachable.
 */
export function StudioSheetStatus({ state }: { state: StudioState }): ReactNode {
  const { workspace, source } = state;

  return (
    <footer className="studio-sheet-status">
      <SignalMark kind={workspace.activating ? 'live' : 'ok'} size="footer" />
      <span className="studio-status-message" role="status" aria-live="polite">
        {workspace.activating
          ? 'Starting 3D…'
          : state.status || (source.terrain ? 'Real terrain' : 'Procedural')}
      </span>
      <DataSources state={state} />
    </footer>
  );
}

/**
 * Bottom bar: viewport tools (inspector toggle, Tour) and a status pill with the
 * source, live status and data attribution. Real-terrain and road credits always stay reachable:
 * inline on desktop, behind "Data sources" on phones.
 */
export function StudioFooter({
  controller: c,
  state,
  inspectorId,
  inspectorToggleRef,
}: {
  controller: StudioController;
  state: StudioState;
  inspectorId: string;
  inspectorToggleRef: Ref<HTMLButtonElement>;
}): ReactNode {
  const { workspace, source } = state;
  const isRoadCreditShown = areRoadsDrawn(state);

  return (
    <FloatingBar as="footer" size="footer" className="studio-footer">
      <BarGroup className="studio-tools" role="group" label="Viewport tools">
        <Button
          variant="text"
          size="small"
          ref={inspectorToggleRef}
          aria-expanded={!workspace.collapsed}
          aria-controls={inspectorId}
          aria-label={workspace.collapsed ? 'Expand controls' : 'Collapse controls'}
          onClick={() => {
            c.workspace({ collapsed: !workspace.collapsed });
          }}
        >
          {workspace.collapsed ? 'Controls ↑' : 'Controls ↓'}
        </Button>
        <Button
          variant="text"
          size="small"
          aria-pressed={source.autoplay.enabled}
          aria-label="Tour"
          title={source.autoplay.enabled ? 'Pause tour' : 'Play tour'}
          onClick={() => {
            void c.autoplay({ enabled: !source.autoplay.enabled });
          }}
        >
          {source.autoplay.enabled ? '❚❚ Tour' : '▶ Tour'}
        </Button>
        <IconButton
          glyph="◧"
          label="Compare presets"
          isActive={workspace.comparePresetsOpen}
          onClick={() => {
            c.endCompare();
            c.workspace({ comparePresetsOpen: !workspace.comparePresetsOpen });
          }}
        />
      </BarGroup>
      <BarGroup className="studio-status">
        <SignalMark kind={workspace.activating ? 'live' : 'ok'} size="footer" />
        <span className="source-label">
          {source.terrain ? 'Real terrain' : `Procedural · ${state.design.seed}`}
        </span>
        <span className="studio-status-message" role="status" aria-live="polite">
          {workspace.activating ? 'Starting 3D…' : state.status}
        </span>
        {source.terrain && (
          <span title={source.terrain.attribution} className="attribution">
            {source.terrain.attribution}
          </span>
        )}
        {isRoadCreditShown && (
          <a
            className="attribution"
            href={roadAttributionUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`${state.roads.network?.attribution ?? ''} (opens in a new tab)`}
          >
            {state.roads.network?.attribution}
          </a>
        )}
        <DataSources state={state} />
        <ThemeToggle />
        <a
          className="studio-github"
          href="https://github.com/conorluddy/landcube"
          target="_blank"
          rel="noreferrer"
        >
          GitHub ↗
        </a>
      </BarGroup>
    </FloatingBar>
  );
}

// === HELPERS ===

/** Dark/light switch; the theme lives on `<html>` (see `theme.ts`), so the button re-reads it on change. */
function ThemeToggle(): ReactNode {
  const theme = useSyncExternalStore(subscribeToTheme, () =>
    currentTheme(document.documentElement),
  );
  const isLight = theme === 'light';

  return (
    <IconButton
      glyph={isLight ? '●' : '○'}
      label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      isActive={isLight}
      onClick={() => {
        applyTheme(isLight ? 'dark' : 'light', document.documentElement, localStorage);
      }}
    />
  );
}

/** Credits behind a disclosure; only shown on phones (see `.mobile-attribution` CSS). */
function DataSources({ state }: { state: StudioState }): ReactNode {
  const { source } = state;
  const isRoadCreditShown = areRoadsDrawn(state);

  if (source.terrain === undefined && !isRoadCreditShown) {
    return null;
  }

  return (
    <details className="mobile-attribution">
      <summary className="mobile-attribution-summary">Data sources</summary>
      <div className="mobile-attribution-sources lc-glass" data-ui-surface>
        {source.terrain && <p className="mobile-attribution-text">{source.terrain.attribution}</p>}
        {isRoadCreditShown && (
          <a
            className="mobile-attribution-link"
            href={roadAttributionUrl}
            target="_blank"
            rel="noreferrer"
          >
            {state.roads.network?.attribution} ↗
          </a>
        )}
      </div>
    </details>
  );
}
