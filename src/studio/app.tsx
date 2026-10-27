import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { roadAttributionUrl } from '../constants/roads';
import {
  areRoadsDrawn,
  threeDOnlySections,
  type StudioController,
  type InspectorSection,
} from './controller';
import { CameraPanel, OrbitPanel } from './camera-panel';
import {
  ColourPanel,
  ContoursPanel,
  OverlaysPanel,
  ScenePanel,
  TerrainPanel,
  type PanelProps,
} from './panels';
import { Button, Group, Hint, NumberField, Range, Select, Toggle } from './fields';
import { ExportPanel } from './export-panel';
import { FramePanel } from './frame-panel';
import type { CropPreview } from './crop-preview';
import type { OutputRenderer } from '../types/export';

const sections: InspectorSection[] = [
  'Terrain',
  'Contours',
  'Colour',
  'Scene',
  'Camera',
  'Model',
  'Frame',
];

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
        !(event.target instanceof Element && event.target.closest('[data-popover-trigger]'))
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
      className={modal ? 'studio-dialog' : 'studio-popover'}
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
    <div className={`studio-shell${state.workspace.collapsed ? ' inspector-collapsed' : ''}`}>
      <header className="studio-header">
        <div className="studio-brand">
          <span aria-hidden="true">≋</span>
          <h1>
            Topogra <small>Landscape studio</small>
          </h1>
        </div>
        <div className="view-switch" role="group" aria-label="View">
          {(['2d', '3d'] as const).map((view) => (
            <button
              type="button"
              key={view}
              aria-pressed={state.workspace.view === view}
              disabled={state.workspace.activating}
              onClick={() => {
                void c.selectView(view);
              }}
            >
              {view.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="view-switch" role="group" aria-label="Terrain source">
          <button
            type="button"
            aria-pressed={state.source.selected === 'generated'}
            onClick={() => {
              c.useGenerated();
            }}
          >
            Procedural
          </button>
          <button
            type="button"
            aria-pressed={state.source.selected === 'real'}
            onClick={() => {
              void c.useCoordinates();
            }}
          >
            Coordinates
          </button>
        </div>
        <div className="header-actions">
          <button
            type="button"
            title="Copies shared design settings. Location and 3D setup are excluded."
            onClick={() => {
              void c.copyLink();
            }}
          >
            Copy style link
          </button>
          <button
            type="button"
            className="primary-button"
            aria-haspopup="dialog"
            onClick={() => {
              c.workspace({ exporting: true, popover: null });
            }}
          >
            Export ↗
          </button>
        </div>
      </header>
      <main
        id="studio-viewport"
        ref={viewport}
        aria-label={`${state.workspace.view.toUpperCase()} landscape viewport`}
      />
      <aside
        id="studio-inspector"
        className="studio-inspector control-panel"
        aria-label="Landscape controls"
        hidden={state.workspace.collapsed}
      >
        <nav className="inspector-sections" aria-label="Editing section">
          {sections
            .filter(
              (section) => !threeDOnlySections.includes(section) || state.workspace.view === '3d',
            )
            .map((section) => (
              <button
                key={section}
                type="button"
                aria-pressed={active === section}
                aria-controls={`inspector-${section.toLowerCase()}`}
                onClick={() => {
                  c.selectSection(section);
                }}
              >
                {section}
              </button>
            ))}
        </nav>
        <div className="inspector-body">
          {sections.map((section) => (
            <section
              key={section}
              id={`inspector-${section.toLowerCase()}`}
              aria-label={`${section} settings`}
              hidden={
                active !== section ||
                (threeDOnlySections.includes(section) && state.workspace.view !== '3d')
              }
            >
              <h2>{section}</h2>
              {section === 'Terrain' && <TerrainPanel {...props} />}
              {section === 'Contours' && <ContoursPanel {...props} />}
              {section === 'Colour' && <ColourPanel {...props} />}
              {section === 'Scene' && <ScenePanel {...props} />}
              {section === 'Camera' && <CameraPanel {...props} />}
              {section === 'Model' && <ModelPanel {...props} cropPreview={cropPreview} />}
              {section === 'Frame' && <FramePanel {...props} />}
            </section>
          ))}
        </div>
      </aside>
      <footer className="studio-footer">
        <div className="viewport-tools">
          <button
            type="button"
            ref={inspectorToggle}
            aria-expanded={!state.workspace.collapsed}
            aria-controls="studio-inspector"
            aria-label={state.workspace.collapsed ? 'Expand controls' : 'Collapse controls'}
            onClick={() => {
              c.workspace({ collapsed: !state.workspace.collapsed });
            }}
          >
            {state.workspace.collapsed ? 'Controls ↑' : 'Controls ↓'}
          </button>
          <button
            type="button"
            data-popover-trigger
            aria-haspopup="dialog"
            aria-expanded={state.workspace.popover === 'Overlays'}
            onClick={() => {
              c.workspace({ popover: state.workspace.popover === 'Overlays' ? null : 'Overlays' });
            }}
          >
            Overlays
          </button>
          {state.workspace.view === '3d' && (
            <button
              type="button"
              data-popover-trigger
              aria-haspopup="dialog"
              aria-expanded={state.workspace.popover === 'Orbit'}
              onClick={() => {
                c.workspace({ popover: state.workspace.popover === 'Orbit' ? null : 'Orbit' });
              }}
            >
              Orbit
            </button>
          )}
          <button
            type="button"
            aria-pressed={state.source.autoplay.enabled}
            aria-label="Tour"
            title={state.source.autoplay.enabled ? 'Pause tour' : 'Play tour'}
            onClick={() => {
              void c.autoplay({ enabled: !state.source.autoplay.enabled });
            }}
          >
            {state.source.autoplay.enabled ? '❚❚ Tour' : '▶ Tour'}
          </button>
        </div>
        <div className="studio-status">
          <span className="source-label">
            {state.source.terrain ? 'Real terrain' : `Procedural · ${state.design.seed}`}
          </span>
          <span role="status" aria-live="polite">
            {state.workspace.activating ? 'Starting 3D…' : state.status}
          </span>
          {state.source.terrain && (
            <span title={state.source.terrain.attribution} className="attribution">
              {state.source.terrain.attribution}
            </span>
          )}
          {areRoadsDrawn(state) && (
            <a
              className="attribution"
              href={roadAttributionUrl}
              target="_blank"
              rel="noreferrer"
              title="Opens in a new tab"
            >
              {state.roads.network?.attribution}
            </a>
          )}
        </div>
        <a
          className="studio-github"
          href="https://github.com/conorluddy/Topogra"
          target="_blank"
          rel="noreferrer"
        >
          GitHub ↗
        </a>
      </footer>
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
