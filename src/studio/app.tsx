import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { InspectorPanel } from '../ui/inspector-panel';
import { threeDOnlySections, type StudioController, type InspectorSection } from './controller';
import { CameraPanel, OrbitPanel } from './camera-panel';
import { ColourPanel, ContoursPanel, OverlaysPanel, ScenePanel, type PanelProps } from './panels';
import { Button, Group, Hint, NumberField, Range, Select, Toggle } from './fields';
import { ExportPanel } from './export-panel';
import { FramePanel } from './frame-panel';
import { ControlGroup } from '../ui/control-group';
import { buildTerrainGroups } from './control-groups/terrain';
import { getGroupCode, studioSections } from './sections';
import { StudioHeader } from './studio-header';
import { StudioFooter } from './studio-footer';
import type { CropPreview } from './crop-preview';
import type { OutputRenderer } from '../types/export';

const inspectorId = 'studio-inspector';
/** Below this the inspector becomes a full-width sheet with a horizontal section strip. */
const phoneViewportQuery = '(max-width: 767px)';

function Surface({
  title,
  close,
  children,
  modal = false,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
  modal?: boolean;
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
      className={`legacy-controls ${modal ? 'studio-dialog' : 'studio-popover'}`}
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
      <div className="surface-heading">
        <h2>{title}</h2>
        <button type="button" aria-label={`Close ${title}`} onClick={close}>
          ×
        </button>
      </div>
      <div className="surface-body">{children}</div>
    </dialog>
  );
}

function ModelPanel({
  controller: c,
  state: s,
  cropPreview,
}: PanelProps & { cropPreview: CropPreview }): ReactNode {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (host.current) {
      return cropPreview.attach(host.current);
    }
  }, [cropPreview]);
  const model = s.model;

  return (
    <>
      <div ref={host} />
      <Group title="Model dimensions">
        <div className="control-grid">
          <NumberField
            label={model.dimensions.cropShape === 'circle' ? 'Diameter (mm)' : 'Width (X, mm)'}
            value={model.dimensions.widthMm}
            min={1}
            max={1000}
            onChange={(value) => value !== undefined && c.dimensions({ widthMm: value })}
          />
          {model.dimensions.cropShape !== 'circle' && (
            <NumberField
              label="Length (Y, mm)"
              value={model.dimensions.lengthMm}
              min={1}
              max={1000}
              onChange={(value) => value !== undefined && c.dimensions({ lengthMm: value })}
            />
          )}
        </div>
        <NumberField
          label="Base thickness (mm)"
          value={model.dimensions.baseThicknessMm}
          min={0.1}
          max={100}
          onChange={(value) => value !== undefined && c.dimensions({ baseThicknessMm: value })}
        />
        <Hint>
          Minimum material below the lowest valley. Overall height:{' '}
          <output>{s.metrics.height?.toFixed(2) ?? '—'} mm</output>.
        </Hint>
      </Group>
      <Group title="Shape">
        <Select
          label="Terrain shape"
          value={model.dimensions.terrainShape ?? 'smooth'}
          options={['smooth', 'terraced']}
          onChange={(value) => c.dimensions({ terrainShape: value })}
        />
        <Toggle
          label="Auto height for location"
          value={model.autoExaggeration}
          onChange={(value) => c.model({ autoExaggeration: value })}
        />
        <Range
          label="Height exaggeration"
          value={model.exaggeration}
          min={0}
          max={1}
          step={0.05}
          suffix="×"
          onChange={(value) => c.model({ exaggeration: value, autoExaggeration: false })}
        />
        {model.dimensions.terrainShape === 'terraced' && (
          <Hint>
            Flat shelves follow the contour interval and are included in STL. Layer height:{' '}
            {s.metrics.layerHeight?.toFixed(3) ?? '—'} mm.
          </Hint>
        )}
        <Hint>Download the prepared model from Export → STL.</Hint>
      </Group>
    </>
  );
}

function Studio({
  controller: c,
  terrain,
  renderer,
  cropPreview,
}: {
  controller: StudioController;
  terrain: SVGSVGElement;
  renderer: OutputRenderer;
  cropPreview: CropPreview;
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
      } else if (!state.workspace.collapsed) {
        c.workspace({ collapsed: true });
        inspectorToggle.current?.focus();
      }
    };

    document.addEventListener('keydown', escape);

    return () => {
      document.removeEventListener('keydown', escape);
    };
  }, [c, state.workspace]);
  const props = { controller: c, state };

  return (
    <div className="studio-shell">
      <StudioHeader controller={c} state={state} />
      <main
        id="studio-viewport"
        ref={viewport}
        aria-label={`${state.workspace.view.toUpperCase()} landscape viewport`}
      />
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
        railOrientation={isPhoneViewport ? 'horizontal' : 'vertical'}
        renderSection={(section) => renderSectionBody(section, props, cropPreview)}
      />
      <StudioFooter
        controller={c}
        state={state}
        inspectorId={inspectorId}
        inspectorToggleRef={inspectorToggle}
      />
      {state.workspace.popover !== null && (
        <Surface
          title={state.workspace.popover}
          close={() => {
            c.workspace({ popover: null });
          }}
        >
          {state.workspace.popover === 'Overlays' ? (
            <OverlaysPanel {...props} />
          ) : (
            <OrbitPanel {...props} />
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
      return legacyControls(<ContoursPanel {...props} />);
    case 'Colour':
      return legacyControls(<ColourPanel {...props} />);
    case 'Camera':
      return legacyControls(<CameraPanel {...props} />);
    case 'Scene':
      return legacyControls(<ScenePanel {...props} />);
    case 'Model':
      return legacyControls(<ModelPanel {...props} cropPreview={cropPreview} />);
    case 'Frame':
      return legacyControls(<FramePanel {...props} />);
  }
}

/** Non-migrated sections keep the legacy field styles until #91-#93 replace them. */
function legacyControls(panel: ReactNode): ReactNode {
  return <div className="legacy-controls">{panel}</div>;
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
      />,
    );
  });
}
