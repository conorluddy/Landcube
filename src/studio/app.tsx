import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { InspectorPanel } from '../ui/inspector-panel';
import { threeDOnlySections, type StudioController, type InspectorSection } from './controller';
import type { PanelProps } from './panels';
import { Button, Hint } from './fields';
import { ExportPanel } from './export-panel';
import { ControlGroup } from '../ui/control-group';
import { GlassPanel } from '../ui/glass-panel';
import { IconButton } from '../ui/icon-button';
import { buildColourGroups } from './control-groups/colour';
import { buildContourGroups } from './control-groups/contours';
import { buildOverlayPopoverGroups } from './control-groups/overlays';
import { buildSceneGroups } from './control-groups/scene';
import { buildCameraGroups, buildOrbitGroup } from './control-groups/camera';
import { buildFrameGroups } from './control-groups/frame';
import { buildModelGroups } from './control-groups/model';
import { buildTerrainGroups } from './control-groups/terrain';
import { getGroupCode, studioSections } from './sections';
import { CommandPaletteHost, isCommandPaletteShortcut } from './command-palette-host';
import { commandPaletteDialogClassName } from '../ui/command-palette';
import { StudioHeader } from './studio-header';
import { StudioFooter } from './studio-footer';
import { StudioMapControls, StudioSheet } from './studio-sheet';
import { ViewportStates } from './viewport-states';
import { StudioHud } from './studio-hud';
import type { HudStore } from './hud-store';
import type { CropPreview } from './crop-preview';
import type { OutputRenderer } from '../types/export';

const inspectorId = 'studio-inspector';
/** Below this the inspector becomes a bottom sheet with a horizontal section strip. */
const phoneViewportQuery = '(max-width: 767px)';

function Surface({
  title,
  close,
  children,
  modal = false,
  isGlass = false,
  bareClassName,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
  modal?: boolean;
  /** Hosts the content in a GlassPanel instead of the legacy dialog chrome (migrated popovers). */
  isGlass?: boolean;
  /** Renders the children with no heading, in a dialog with this class; they bring their own panel. */
  bareClassName?: string;
}): ReactNode {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(close);

  closeRef.current = close;
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;

    if (!dialog) {
      return;
    }

    if (modal) {
      dialog.showModal();
    } else {
      dialog.show();
    }

    const focusable = dialog.querySelector<HTMLElement>('button, input, select, a[href]');

    focusable?.focus();

    const dismissOutside = (event: PointerEvent) => {
      if (
        !modal &&
        event.target instanceof Node &&
        !dialog.contains(event.target) &&
        !(event.target instanceof Element && event.target.closest('[aria-haspopup="dialog"]'))
      ) {
        closeRef.current();
      }
    };

    document.addEventListener('pointerdown', dismissOutside);

    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      dialog.close();

      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus();
      }
    };
  }, [modal]);

  return (
    <dialog
      ref={ref}
      className={
        bareClassName ??
        (isGlass
          ? `lc-popover${modal ? ' lc-popover--modal' : ''}`
          : `legacy-controls ${modal ? 'studio-dialog' : 'studio-popover'}`)
      }
      data-ui-surface
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          close();
        }

        if (event.key === 'Tab' && !modal) {
          const items = [
            ...event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]',
            ),
          ];
          const first = items[0];
          const last = items.at(-1);

          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }}
    >
      {bareClassName !== undefined ? (
        children
      ) : isGlass ? (
        <GlassPanel padding="none" className="lc-popover__panel">
          <div className="lc-popover__heading">
            <h2 className="lc-popover__title">{title}</h2>
            <IconButton glyph="×" label={`Close ${title}`} onClick={close} />
          </div>
          <div className="lc-popover__body">{children}</div>
        </GlassPanel>
      ) : (
        <>
          <div className="surface-heading">
            <h2>{title}</h2>
            <button type="button" aria-label={`Close ${title}`} onClick={close}>
              ×
            </button>
          </div>
          <div className="surface-body">{children}</div>
        </>
      )}
    </dialog>
  );
}

function Studio({
  controller: c,
  terrain,
  renderer,
  cropPreview,
  hud,
}: {
  controller: StudioController;
  terrain: SVGSVGElement;
  renderer: OutputRenderer;
  cropPreview: CropPreview;
  hud: HudStore;
}): ReactNode {
  const state = useSyncExternalStore(c.subscribe, c.getSnapshot);
  const viewport = useRef<HTMLDivElement>(null);
  const inspectorToggle = useRef<HTMLButtonElement>(null);
  const active = state.workspace.sections[state.workspace.view];
  const isPhoneViewport = useSyncExternalStore(subscribeToPhoneViewport, readIsPhoneViewport);

  useLayoutEffect(() => {
    viewport.current?.append(terrain);
  }, [terrain]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) {
        return;
      }

      if (state.workspace.exporting) {
        c.workspace({ exporting: false });
      } else if (state.workspace.popover !== null) {
        c.workspace({ popover: null });
      } else if (!isPhoneViewport && !state.workspace.collapsed) {
        c.workspace({ collapsed: true });
        inspectorToggle.current?.focus();
      }
    };

    document.addEventListener('keydown', escape);

    return () => {
      document.removeEventListener('keydown', escape);
    };
  }, [c, state.workspace, isPhoneViewport]);
  useEffect(() => {
    const openPalette = (event: KeyboardEvent) => {
      if (!isCommandPaletteShortcut(event)) {
        return;
      }

      event.preventDefault();

      if (c.getSnapshot().workspace.palette === null) {
        c.workspace({ palette: { query: '' } });
      }
    };

    document.addEventListener('keydown', openPalette);

    return () => {
      document.removeEventListener('keydown', openPalette);
    };
  }, [c]);
  const props = { controller: c, state };

  return (
    <div
      className="studio-shell"
      data-sheet-snap={isPhoneViewport ? state.workspace.sheetSnap : undefined}
    >
      <StudioHeader controller={c} state={state} isPhoneViewport={isPhoneViewport} />
      <main
        id="studio-viewport"
        ref={viewport}
        aria-label={`${state.workspace.view.toUpperCase()} landscape viewport`}
      />
      <ViewportStates controller={c} state={state} />
      <StudioHud state={state} hud={hud} />
      {isPhoneViewport ? (
        <>
          <StudioMapControls controller={c} state={state} />
          <StudioSheet
            controller={c}
            state={state}
            hud={hud}
            id={inspectorId}
            renderSection={(section) => renderSectionBody(section, props, cropPreview)}
          />
        </>
      ) : (
        <>
          <InspectorPanel
            id={inspectorId}
            label="Landscape controls"
            railLabel="Editing section"
            sections={studioSections}
            activeSectionId={active}
            onSelectSection={(section) => {
              c.selectSection(section);
            }}
            hiddenSectionIds={state.workspace.view === '3d' ? [] : threeDOnlySections}
            isCollapsed={state.workspace.collapsed}
            headerTag={`Src · ${state.source.terrain ? 'Real' : 'Procedural'}`}
            renderSection={(section) => renderSectionBody(section, props, cropPreview)}
          />
          <StudioFooter
            controller={c}
            state={state}
            inspectorId={inspectorId}
            inspectorToggleRef={inspectorToggle}
          />
        </>
      )}
      {state.workspace.popover !== null && (
        <Surface
          title={state.workspace.popover}
          isGlass={state.workspace.popover === 'Overlays'}
          close={() => {
            c.workspace({ popover: null });
          }}
        >
          {state.workspace.popover === 'Overlays' ? (
            buildOverlayPopoverGroups(c, state).map((group) => (
              <ControlGroup key={group.id} group={group} code={getGroupCode(group.id)} />
            ))
          ) : (
            <ControlGroup group={buildOrbitGroup(c, state, false)} code={getGroupCode('orbit')} />
          )}
        </Surface>
      )}
      {state.workspace.exporting && (
        <Surface
          modal
          isGlass
          title="Export"
          close={() => {
            c.workspace({ exporting: false });
          }}
        >
          <ExportPanel {...props} renderer={renderer} />
        </Surface>
      )}
      {state.workspace.palette !== null && (
        <Surface
          modal
          bareClassName={commandPaletteDialogClassName}
          title="Command palette"
          close={() => {
            c.workspace({ palette: null });
          }}
        >
          <CommandPaletteHost controller={c} state={state} isMobile={isPhoneViewport} />
        </Surface>
      )}
      {state.manualLink !== '' && (
        <Surface
          modal
          title="Copy style link"
          close={() => {
            c.dismissManualLink();
          }}
        >
          <Hint>
            Clipboard access is unavailable. Select and copy this link. Location and 3D settings are
            excluded.
          </Hint>
          <label>
            Copy this link
            <input
              type="text"
              readOnly
              value={state.manualLink}
              onFocus={(event) => {
                event.target.select();
              }}
            />
          </label>
          <Button
            onClick={() => {
              c.dismissManualLink();
            }}
          >
            Done
          </Button>
        </Surface>
      )}
    </div>
  );
}

/** Today's legacy panel for a section; #90-#93 replace these with ControlGroup builders. */
function renderSectionBody(
  section: InspectorSection,
  props: PanelProps,
  cropPreview: CropPreview,
): ReactNode {
  switch (section) {
    case 'Terrain':
      return buildTerrainGroups(props.controller, props.state).map((group) => (
        <ControlGroup key={group.id} group={group} code={getGroupCode(group.id)} />
      ));
    case 'Contours':
      return buildContourGroups(props.controller, props.state).map((group) => (
        <ControlGroup key={group.id} group={group} code={getGroupCode(group.id)} />
      ));
    case 'Colour':
      return buildColourGroups(props.controller, props.state).map((group) => (
        <ControlGroup key={group.id} group={group} code={getGroupCode(group.id)} />
      ));
    case 'Camera':
      return buildCameraGroups(props.controller, props.state).map((group) => (
        <ControlGroup key={group.id} group={group} code={getGroupCode(group.id)} />
      ));
    case 'Scene':
      return buildSceneGroups(props.controller, props.state).map((group) => (
        <ControlGroup key={group.id} group={group} code={getGroupCode(group.id)} />
      ));
    case 'Model':
      return buildModelGroups(props.controller, props.state, cropPreview).map((group) => (
        <ControlGroup key={group.id} group={group} code={getGroupCode(group.id)} />
      ));
    case 'Frame':
      return buildFrameGroups(props.controller, props.state).map((group) => (
        <ControlGroup key={group.id} group={group} code={getGroupCode(group.id)} />
      ));
  }
}

function subscribeToPhoneViewport(onChange: () => void): () => void {
  const query = matchMedia(phoneViewportQuery);

  query.addEventListener('change', onChange);

  return () => {
    query.removeEventListener('change', onChange);
  };
}

function readIsPhoneViewport(): boolean {
  return matchMedia(phoneViewportQuery).matches;
}

export function mountStudio(
  controller: StudioController,
  terrain: SVGSVGElement,
  renderer: OutputRenderer,
  cropPreview: CropPreview,
  hud: HudStore,
): void {
  const root = document.createElement('div');

  root.id = 'studio';
  document.body.append(root);
  flushSync(() => {
    createRoot(root).render(
      <Studio
        controller={controller}
        terrain={terrain}
        renderer={renderer}
        cropPreview={cropPreview}
        hud={hud}
      />,
    );
  });
}
