import { useEffect, useRef, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { BottomSheet } from '../ui/bottom-sheet';
import { Button } from '../ui/button';
import { FloatingBar } from '../ui/floating-bar';
import { IconButton } from '../ui/icon-button';
import { getInspectorSectionId } from '../ui/inspector-panel';
import { ReadoutCell, ReadoutGrid } from '../ui/readout-grid';
import { SectionRail } from '../ui/section-rail';
import {
  getActiveSection,
  getHiddenSections,
  type InspectorSection,
  type StudioController,
  type StudioState,
} from './controller';
import { describeSheetReadouts, describeTarget } from './hud-readouts';
import type { HudStore } from './hud-store';
import { studioSections } from './sections';
import { describeSheetShortcuts, revealControlGroup } from './sheet-shortcuts';
import { getActiveTool } from './studio-tools';
import { StudioSheetStatus } from './studio-footer';

/** Clears the one-row phone header (12px inset + 40px bar + 12px gap). */
const sheetFullTopInsetPx = 64;

/**
 * Phone inspector (#97): a bottom sheet that is `aside#{id}` like the desktop InspectorPanel, with
 * readouts, Export and status in the peek row, the section tab strip pinned above the body, and
 * one `section#inspector-{id}` per section in the body.
 */
export function StudioSheet({
  controller: c,
  state,
  hud,
  id,
  routeProfile,
  renderSection,
}: {
  controller: StudioController;
  state: StudioState;
  hud: HudStore;
  id: string;
  /** The route profile, shown at the top of the sheet body while a route exists (REQ-25). */
  routeProfile?: ReactNode;
  renderSection: (section: InspectorSection) => ReactNode;
}): ReactNode {
  const { workspace } = state;
  const activeSectionId = getActiveSection(state);
  const hiddenSectionIds = getHiddenSections(state);

  return (
    <BottomSheet
      id={id}
      label="Landscape controls"
      snap={workspace.sheetSnap}
      fullTopInsetPx={sheetFullTopInsetPx}
      onSnapChange={(sheetSnap) => {
        c.workspace({ sheetSnap });
      }}
      peek={<SheetPeek controller={c} state={state} hud={hud} />}
      header={
        <SectionRail
          label="Editing section"
          sections={studioSections}
          activeSectionId={activeSectionId}
          hiddenSectionIds={hiddenSectionIds}
          orientation="horizontal"
          getPanelId={getInspectorSectionId}
          onSelectSection={(section) => {
            c.selectSection(section);

            if (workspace.sheetSnap === 'peek') {
              c.workspace({ sheetSnap: 'half' });
            }
          }}
        />
      }
    >
      {routeProfile}
      {studioSections.map((section) => (
        <section
          key={section.id}
          id={getInspectorSectionId(section.id)}
          className="lc-inspector__section"
          aria-label={`${section.title} settings`}
          hidden={section.id !== activeSectionId || hiddenSectionIds.includes(section.id)}
        >
          {renderSection(section.id)}
        </section>
      ))}
    </BottomSheet>
  );
}

/**
 * Phone map controls (P-04 in a mobile FloatingBar) down the right edge: the canvas tools (reset
 * the 3D camera, the command palette, crop in 3D, measure, route on real terrain), then, while the
 * sheet is closed, the sheet shortcuts that stagger in below them. Tools that cannot act in the
 * current view are left out rather than disabled: a dead button would push the column into the
 * sheet. Hidden while the sheet is full (CSS on `[data-sheet-snap]`).
 */
export function StudioMapControls({
  controller: c,
  state,
  sheetId,
}: {
  controller: StudioController;
  state: StudioState;
  sheetId: string;
}): ReactNode {
  const { workspace } = state;
  const is3d = workspace.view === '3d';

  return (
    <FloatingBar size="mobile" className="studio-map-controls">
      {is3d && (
        <IconButton
          glyph="N"
          label="Reset view"
          onClick={() => {
            c.resetCamera();
          }}
        />
      )}
      <IconButton
        glyph="⌘"
        label="Command palette"
        hasPopup="dialog"
        isExpanded={workspace.palette !== null}
        onClick={() => {
          c.workspace({ palette: { query: '' } });
        }}
      />
      {is3d && (
        <IconButton
          glyph="◢"
          label="Crop tool"
          isActive={getActiveTool(state) === 'crop'}
          onClick={() => {
            toggleTool(c, state, 'crop');
          }}
        />
      )}
      <IconButton
        glyph="↔"
        label="Measure tool"
        isActive={getActiveTool(state) === 'measure'}
        onClick={() => {
          toggleTool(c, state, 'measure');
        }}
      />
      {state.source.terrain !== undefined && (
        <IconButton
          glyph="⌇"
          label="Route tool"
          isActive={getActiveTool(state) === 'route'}
          onClick={() => {
            toggleTool(c, state, 'route');
          }}
        />
      )}
      <SheetShortcuts controller={c} state={state} sheetId={sheetId} />
    </FloatingBar>
  );
}

// === HELPERS ===

/**
 * One-tap routes into the closed sheet. Always in the tree so CSS can stagger them in and out on
 * `[data-sheet-snap]`; inert and hidden from assistive tech whenever the sheet is open, since
 * the sheet itself is the route then.
 */
function SheetShortcuts({
  controller: c,
  state,
  sheetId,
}: {
  controller: StudioController;
  state: StudioState;
  sheetId: string;
}): ReactNode {
  const isShown = state.workspace.sheetSnap === 'closed';
  const shortcuts = describeSheetShortcuts(state);
  const reveal = usePendingReveal(sheetId);

  return (
    <div
      className="studio-sheet-shortcuts"
      role="group"
      aria-label="Open controls"
      inert={!isShown}
      style={{ '--studio-shortcut-count': shortcuts.length } as CSSProperties}
    >
      {shortcuts.map((shortcut, index) => (
        <div
          key={shortcut.id}
          className="studio-sheet-shortcuts__item"
          style={{ '--studio-shortcut-index': index } as CSSProperties}
        >
          <IconButton
            glyph={shortcut.glyph}
            label={shortcut.label}
            hasPopup={shortcut.kind === 'export' ? 'dialog' : undefined}
            onClick={() => {
              if (shortcut.kind === 'export') {
                c.workspace({ exporting: true });

                return;
              }

              c.selectSection(shortcut.sectionId);
              c.workspace({ sheetSnap: 'full' });
              reveal(shortcut.groupId);
            }}
          />
        </div>
      ))}
    </div>
  );
}

/** Frames to wait for a newly selected section to lay out before giving up on the reveal. */
const revealFrameBudget = 5;

/**
 * Reveals a group once its section has rendered: the section mounts on a later frame, so this
 * polls a few frames for it. A newer reveal or an unmount cancels the pending one.
 */
function usePendingReveal(sheetId: string): (groupId: string) => void {
  const frame = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      if (frame.current !== undefined) {
        cancelAnimationFrame(frame.current);
      }
    },
    [],
  );

  return (groupId) => {
    if (frame.current !== undefined) {
      cancelAnimationFrame(frame.current);
    }

    let framesLeft = revealFrameBudget;

    const attempt = () => {
      frame.current = undefined;
      const sheet = document.getElementById(sheetId);

      if (sheet !== null && revealControlGroup(sheet, groupId)) {
        return;
      }

      framesLeft -= 1;

      if (framesLeft > 0) {
        frame.current = requestAnimationFrame(attempt);
      }
    };

    frame.current = requestAnimationFrame(attempt);
  };
}

/** The phone mode bar: a tool drops the sheet to peek (or leaves it closed) so the canvas is free to work on. */
function toggleTool(
  c: StudioController,
  state: StudioState,
  tool: 'crop' | 'measure' | 'route',
): void {
  if (getActiveTool(state) === tool) {
    c.workspace({ toolMode: 'none' });
  } else {
    c.workspace({
      toolMode: tool,
      sheetSnap: state.workspace.sheetSnap === 'closed' ? 'closed' : 'peek',
    });
  }
}

/** Readouts the desktop Target lock card shows, cut to three, beside the Export action. */
function SheetPeek({
  controller: c,
  state,
  hud,
}: {
  controller: StudioController;
  state: StudioState;
  hud: HudStore;
}): ReactNode {
  const { generatedReliefMeters } = useSyncExternalStore(hud.subscribe, hud.getSnapshot);
  const cells = describeSheetReadouts(describeTarget(state, generatedReliefMeters));

  return (
    <div className="studio-sheet-peek">
      <div className="studio-sheet-peek__row">
        <ReadoutGrid>
          {cells.map((cell) => (
            <ReadoutCell key={cell.label} {...cell} />
          ))}
        </ReadoutGrid>
        <Button
          variant="primary"
          size="small"
          aria-haspopup="dialog"
          onClick={() => {
            c.workspace({ exporting: true });
          }}
        >
          Export ↗
        </Button>
      </div>
      <StudioSheetStatus state={state} />
    </div>
  );
}
