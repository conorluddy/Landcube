import { useSyncExternalStore, type ReactNode } from 'react';
import { BottomSheet } from '../ui/bottom-sheet';
import { Button } from '../ui/button';
import { FloatingBar } from '../ui/floating-bar';
import { IconButton } from '../ui/icon-button';
import { getInspectorSectionId } from '../ui/inspector-panel';
import { ReadoutCell, ReadoutGrid } from '../ui/readout-grid';
import { SectionRail } from '../ui/section-rail';
import {
  threeDOnlySections,
  type InspectorSection,
  type StudioController,
  type StudioState,
} from './controller';
import { describeSheetReadouts, describeTarget } from './hud-readouts';
import type { HudStore } from './hud-store';
import { studioSections } from './sections';
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
  const activeSectionId = workspace.sections[workspace.view];
  const hiddenSectionIds = workspace.view === '3d' ? [] : threeDOnlySections;

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
 * Phone map controls (P-04 in a mobile FloatingBar) down the right edge: reset the 3D camera,
 * Overlays, the command palette, the crop (3D), measure and route (real terrain) tools, and Orbit in 3D. Hidden while the sheet is full (CSS on `[data-sheet-snap]`).
 */
export function StudioMapControls({
  controller: c,
  state,
}: {
  controller: StudioController;
  state: StudioState;
}): ReactNode {
  const { workspace } = state;
  const is3d = workspace.view === '3d';

  return (
    <FloatingBar size="mobile" className="studio-map-controls">
      <IconButton
        glyph="N"
        label="Reset view"
        disabled={!is3d}
        onClick={() => {
          c.resetCamera();
        }}
      />
      <IconButton
        glyph="◫"
        label="Overlays"
        hasPopup="dialog"
        isExpanded={workspace.popover === 'Overlays'}
        onClick={() => {
          c.workspace({ popover: workspace.popover === 'Overlays' ? null : 'Overlays' });
        }}
      />
      <IconButton
        glyph="⌘"
        label="Command palette"
        hasPopup="dialog"
        isExpanded={workspace.palette !== null}
        onClick={() => {
          c.workspace({ palette: { query: '' } });
        }}
      />
      <IconButton
        glyph="◢"
        label="Crop tool"
        isActive={getActiveTool(state) === 'crop'}
        disabled={!is3d}
        onClick={() => {
          toggleTool(c, state, 'crop');
        }}
      />
      <IconButton
        glyph="↔"
        label="Measure tool"
        isActive={getActiveTool(state) === 'measure'}
        onClick={() => {
          toggleTool(c, state, 'measure');
        }}
      />
      <IconButton
        glyph="⌇"
        label="Route tool"
        isActive={getActiveTool(state) === 'route'}
        disabled={state.source.terrain === undefined}
        onClick={() => {
          toggleTool(c, state, 'route');
        }}
      />
      {is3d && (
        <IconButton
          glyph="⌖"
          label="Orbit"
          hasPopup="dialog"
          isExpanded={workspace.popover === 'Orbit'}
          onClick={() => {
            c.workspace({ popover: workspace.popover === 'Orbit' ? null : 'Orbit' });
          }}
        />
      )}
    </FloatingBar>
  );
}

// === HELPERS ===

/** The phone mode bar: a tool drops the sheet to peek so the canvas is free to work on. */
function toggleTool(
  c: StudioController,
  state: StudioState,
  tool: 'crop' | 'measure' | 'route',
): void {
  if (getActiveTool(state) === tool) {
    c.workspace({ toolMode: 'none' });
  } else {
    c.workspace({ toolMode: tool, sheetSnap: 'peek' });
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
            c.workspace({ exporting: true, popover: null });
          }}
        >
          Export ↗
        </Button>
      </div>
      <StudioSheetStatus state={state} />
    </div>
  );
}
