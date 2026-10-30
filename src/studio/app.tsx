import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { InspectorPanel } from '../ui/inspector-panel';
import {
  threeDOnlySections,
  type StudioController,
  type StudioMode,
  type InspectorSection,
  type PanelProps,
} from './controller';
import { createModeFlip, type ModeFlip } from './mode-flip';
import { DossierPanel } from './dossier-panel';
import { ExportPanel } from './export-panel';
import { ControlGroup } from '../ui/control-group';
import { GlassPanel } from '../ui/glass-panel';
import { Button } from '../ui/button';
import { StatusMessage } from '../ui/status-message';
import { TextField } from '../ui/text-field';
import { IconButton } from '../ui/icon-button';
import { createPinnedPlaceholder } from '../ui/layout-manager';
import { buildOverlayPopoverGroups } from './control-groups/overlays';
import { buildOrbitGroup } from './control-groups/camera';
import { buildSectionGroups } from './control-groups';
import { StudioPinnedPanels } from './pinned-panels';
import { getGroupCode, studioSections } from './sections';
import { CommandPaletteHost, isCommandPaletteShortcut } from './command-palette-host';
import { commandPaletteDialogClassName } from '../ui/command-palette';
import { StudioHeader } from './studio-header';
import { StudioFooter } from './studio-footer';
import { StudioMapControls, StudioSheet } from './studio-sheet';
import { ViewportStates } from './viewport-states';
import { StudioHud } from './studio-hud';
import { CompareHost } from './compare-host';
import type { CompareSceneStore } from './compare-scene';
import { StudioToolBar } from './studio-tools';
import type { HudStore } from './hud-store';
import type { CropPreview } from './crop-preview';
import type { OutputRenderer } from '../types/export';
import { PhonePages } from './pages/phone-pages';

const inspectorId = 'studio-inspector';

// The design-system gallery is its own chunk: the studio bundle never carries the registry or specimens.
const loadSystemMode = () => import('../system/system-mode');
const SystemMode = lazy(loadSystemMode);

/** Below this the inspector becomes a bottom sheet with a horizontal section strip. */
export const phoneViewportQuery = '(max-width: 767px)';

function Surface({
  title,
  close,
  children,
  modal = false,
  bareClassName,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
  modal?: boolean;
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
      className={bareClassName ?? `lc-popover${modal ? ' lc-popover--modal' : ''}`}
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
      ) : (
        <GlassPanel padding="none" className="lc-popover__panel">
          <div className="lc-popover__heading">
            <h2 className="lc-popover__title">{title}</h2>
            <IconButton glyph="×" label={`Close ${title}`} onClick={close} />
          </div>
          <div className="lc-popover__body">{children}</div>
        </GlassPanel>
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
  compareScenes,
}: {
  controller: StudioController;
  terrain: SVGSVGElement;
  renderer: OutputRenderer;
  cropPreview: CropPreview;
  hud: HudStore;
  compareScenes: CompareSceneStore;
}): ReactNode {
  const state = useSyncExternalStore(c.subscribe, c.getSnapshot);
  const viewport = useRef<HTMLDivElement>(null);
  const inspectorToggle = useRef<HTMLButtonElement>(null);
  const active = state.workspace.sections[state.workspace.view];
  const isPhoneViewport = useSyncExternalStore(subscribeToPhoneViewport, readIsPhoneViewport);
  const [modeFlip] = useState(() => createStudioModeFlip(c));
  const flip = useSyncExternalStore(modeFlip.subscribe, modeFlip.getSnapshot);
  const isSystemShown = !isPhoneViewport && flip.shownMode === 'system';

  const requestMode = (mode: StudioMode) => {
    if (mode === 'system') {
      void loadSystemMode();
    }

    modeFlip.request(mode);
  };

  useLayoutEffect(() => {
    viewport.current?.append(terrain);
  }, [terrain]);
  useEffect(() => modeFlip.dispose, [modeFlip]);
  // System mode is desktop-only, and a mode set elsewhere (a link, a phone rotation) shows without a flip.
  useEffect(() => {
    if (isPhoneViewport && state.workspace.mode === 'system') {
      c.workspace({ mode: 'studio' });
    } else if (!flip.isBusy && flip.shownMode !== state.workspace.mode) {
      modeFlip.snapTo(state.workspace.mode);
    }
  }, [c, modeFlip, isPhoneViewport, state.workspace.mode, flip.isBusy, flip.shownMode]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) {
        return;
      }

      if (state.workspace.mode === 'system') {
        if (!isTextEntry(event.target)) {
          modeFlip.request('studio');
        }
      } else if (state.workspace.exporting) {
        c.workspace({ exporting: false });
      } else if (state.workspace.compare !== null) {
        c.endCompare();
      } else if (state.workspace.comparePresetsOpen) {
        c.workspace({ comparePresetsOpen: false });
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
  }, [c, modeFlip, state.workspace, isPhoneViewport]);
  useEffect(() => {
    const openPalette = (event: KeyboardEvent) => {
      if (!isCommandPaletteShortcut(event) || c.getSnapshot().workspace.mode === 'system') {
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
      data-page-hidden={isPhoneViewport && state.workspace.page !== 'studio' ? true : undefined}
      data-mode-target={isPhoneViewport ? 'studio' : state.workspace.mode}
      data-flip={flip.isBusy ? flip.transition : undefined}
      style={
        flip.isBusy
          ? ({ '--lc-mode-flip-angle': `${String(flip.angleDegrees)}deg` } as CSSProperties)
          : undefined
      }
    >
      <main
        id="studio-viewport"
        className="studio-viewport"
        ref={viewport}
        aria-label={`${state.workspace.view.toUpperCase()} landscape viewport`}
        inert={isSystemShown}
      />
      <div className="studio-ground" aria-hidden="true" />
      {flip.isBusy && <div key={flip.sweepCount} className="studio-scan" aria-hidden="true" />}
      {isSystemShown ? (
        <Suspense fallback={null}>
          <SystemMode
            partId={state.workspace.systemPartId}
            onSelectPart={(systemPartId) => {
              c.workspace({ systemPartId });
            }}
            onExit={() => {
              requestMode('studio');
            }}
          />
        </Suspense>
      ) : (
        <>
          <StudioHeader controller={c} state={state} isPhoneViewport={isPhoneViewport} />
          <ViewportStates controller={c} state={state} />
          {!isPhoneViewport && <CompareHost controller={c} state={state} scenes={compareScenes} />}
          <StudioHud controller={c} state={state} hud={hud} />
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
              <PhonePages controller={c} state={state} renderer={renderer} />
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
                renderSection={(section) =>
                  renderSectionBody(section, props, cropPreview, {
                    pinnedGroupIds: new Set(state.workspace.pinnedGroups.map(({ id }) => id)),
                    pin: c.pinGroup,
                    dock: c.dockGroup,
                  })
                }
              />
              <StudioPinnedPanels controller={c} state={state} cropPreview={cropPreview} />
              <StudioToolBar controller={c} state={state} />
              <StudioFooter
                controller={c}
                state={state}
                inspectorId={inspectorId}
                inspectorToggleRef={inspectorToggle}
                onOpenSystem={() => {
                  requestMode('system');
                }}
                onPreloadSystem={() => {
                  void loadSystemMode();
                }}
              />
            </>
          )}
        </>
      )}
      {state.workspace.popover !== null && (
        <Surface
          title={state.workspace.popover}
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
          title="Export"
          close={() => {
            c.workspace({ exporting: false });
          }}
        >
          <ExportPanel {...props} renderer={renderer} />
        </Surface>
      )}
      {state.workspace.dossierOpen && (
        <Surface
          modal
          title="Model dossier"
          close={() => {
            c.workspace({ dossierOpen: false });
          }}
        >
          <DossierPanel {...props} renderer={renderer} hud={hud} />
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
          <div className="studio-copy-link">
            <StatusMessage kind="info">
              Clipboard access is unavailable. Select and copy this link. Location and 3D settings
              are excluded.
            </StatusMessage>
            <TextField label="Copy this link" value={state.manualLink} isReadOnly />
            <Button
              variant="primary"
              onClick={() => {
                c.dismissManualLink();
              }}
            >
              Done
            </Button>
          </div>
        </Surface>
      )}
    </div>
  );
}

/** Desktop only: groups can float out of the inspector, leaving a placeholder behind. */
interface GroupPinning {
  pinnedGroupIds: ReadonlySet<string>;
  pin: (id: string) => void;
  dock: (id: string) => void;
}

/** A section's control groups; with `pinning`, pinnable groups get a pin button. */
function renderSectionBody(
  section: InspectorSection,
  props: PanelProps,
  cropPreview: CropPreview,
  pinning?: GroupPinning,
): ReactNode {
  return buildSectionGroups(section, props.controller, props.state, cropPreview).map((group) => {
    const code = getGroupCode(group.id);

    if (pinning?.pinnedGroupIds.has(group.id) === true) {
      const placeholder = createPinnedPlaceholder(group, () => {
        pinning.dock(group.id);
      });

      return <ControlGroup key={group.id} group={placeholder} code={code} />;
    }

    return (
      <ControlGroup
        key={group.id}
        group={group}
        code={code}
        onPin={
          pinning &&
          (() => {
            pinning.pin(group.id);
          })
        }
      />
    );
  });
}

function createStudioModeFlip(c: StudioController): ModeFlip {
  return createModeFlip({
    initialMode: c.getSnapshot().workspace.mode,
    commit: (mode) => {
      c.workspace({ mode });
    },
    prefersReducedMotion: () => matchMedia('(prefers-reduced-motion: reduce)').matches,
    timers: {
      setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
      clearTimeout: (handle) => {
        window.clearTimeout(handle);
      },
    },
  });
}

/** Keys typed into a field belong to the field, not to shell shortcuts. */
function isTextEntry(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
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
  compareScenes: CompareSceneStore,
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
        compareScenes={compareScenes}
      />,
    );
  });
}
