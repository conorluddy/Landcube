import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { TerrainCropSettings } from '../terrain-crop';
import { CalloutLabel } from '../ui/overlays/callout-label';
import { CropFrame } from '../ui/overlays/crop-frame';
import {
  MeasureLine,
  type MeasureEndpoint,
  type MeasurePoint,
  type MeasurePointer,
} from '../ui/overlays/measure-line';
import { RouteTool } from './route-tool';
import { hasPendingRouteReplacement } from './route-actions';
import { FloatingBar } from '../ui/floating-bar';
import { Segmented, type SegmentedOption } from '../ui/segmented';
import type { StudioController, StudioState, ToolMode } from './controller';
import type { HudStore, MapLocation } from './hud-store';
import {
  bearingDegrees,
  distanceBetweenPlaces,
  formatBearing,
  formatDistance,
  getCropFractionBox,
  getNudgeDelta,
  getRouteKeyAction,
  resizeCrop,
  type CropFrameSource,
} from './tool-state';

/**
 * On-canvas tools (#102): the desktop tool bar, the C / M / Escape shortcuts, and the crop frame
 * and measure line the HUD's `tools` slot shows. Crop edits go through `controller.model`, so the
 * Model section's crop widget and this frame always read the same `state.model.crop`.
 */
type PlacedPoint = MeasurePoint & { location?: MapLocation };
type Measurement =
  | { kind: 'empty' }
  | { kind: 'anchored'; start: PlacedPoint }
  | { kind: 'measured'; start: PlacedPoint; end: PlacedPoint };

/** Pointer travel below this is a tap that places one endpoint, not a drag. */
const tapSlopPx = 4;
const toolShortcuts: Partial<Record<string, ToolMode>> = { c: 'crop', m: 'measure', r: 'route' };

// === PUBLIC API ===

/** The tool the canvas shows: crop exists only in 3D, route only on real terrain; presets belong to another issue. */
export function getActiveTool(state: StudioState): 'none' | 'crop' | 'measure' | 'route' {
  const { toolMode, view } = state.workspace;

  if (
    toolMode === 'measure' ||
    (toolMode === 'crop' && view === '3d') ||
    (toolMode === 'route' && state.source.terrain !== undefined)
  ) {
    return toolMode;
  }

  return 'none';
}

/** Desktop glass pill at the frame's top left: Select, Crop (3D only) and Measure. */
export function StudioToolBar({
  controller: c,
  state,
}: {
  controller: StudioController;
  state: StudioState;
}): ReactNode {
  const is3d = state.workspace.view === '3d';
  const options: SegmentedOption<'none' | 'crop' | 'measure' | 'route'>[] = [
    { value: 'none', label: 'Select', description: 'Select (Esc)' },
    ...(is3d ? [{ value: 'crop' as const, label: 'Crop', description: 'Crop the model (C)' }] : []),
    { value: 'measure', label: 'Measure', description: 'Measure a distance (M)' },
    ...(state.source.terrain === undefined
      ? []
      : [{ value: 'route' as const, label: 'Route', description: 'Draw a route (R)' }]),
  ];

  return (
    <FloatingBar className="studio-tool-bar">
      <Segmented
        label="Tool"
        isLabelVisible={false}
        size="bar"
        isOnGlassBar
        value={getActiveTool(state)}
        options={options}
        onChange={(toolMode) => {
          c.workspace({ toolMode });
        }}
      />
    </FloatingBar>
  );
}

/** Content for the HUD `tools` slot, plus the tool shortcuts while the studio is mounted. */
export function StudioToolOverlays({
  controller: c,
  state,
  hud,
  viewportSize,
}: {
  controller: StudioController;
  state: StudioState;
  hud: HudStore;
  viewportSize: { width: number; height: number } | undefined;
}): ReactNode {
  useToolShortcuts(c);
  const activeTool = getActiveTool(state);

  if (activeTool === 'crop' && viewportSize !== undefined) {
    return <CropTool controller={c} state={state} viewportSize={viewportSize} />;
  }

  if (activeTool === 'measure') {
    return <MeasureTool key={state.workspace.view} hud={hud} />;
  }

  if (activeTool === 'route') {
    return <RouteTool controller={c} state={state} hud={hud} viewportSize={viewportSize} />;
  }

  return null;
}

// === HELPERS ===

/**
 * C and M toggle their tool and Escape returns to Select. Ignored while typing, with modifiers,
 * or while a dialog (export, palette) or popover owns the keyboard. Capture phase, so Escape here
 * wins over the studio's collapse-the-inspector Escape.
 */
function useToolShortcuts(c: StudioController): void {
  useEffect(() => {
    const pressKey = (event: KeyboardEvent) => {
      const state = c.getSnapshot();
      const { workspace } = state;

      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        workspace.exporting ||
        workspace.palette !== null ||
        workspace.popover !== null ||
        hasPendingRouteReplacement() ||
        isTextEntry(event.target)
      ) {
        return;
      }

      if (event.key === 'Escape') {
        // Escape first leaves drawing or editing (keeping the route); the next one leaves the tool.
        if (
          getActiveTool(state) === 'route' &&
          getRouteKeyAction(event.key, workspace.route?.editing ?? { mode: 'viewing' }) === 'escape'
        ) {
          event.preventDefault();
          c.escapeRoute();

          return;
        }

        if (workspace.toolMode !== 'none') {
          event.preventDefault();
          c.workspace({ toolMode: 'none' });
        }

        return;
      }

      const shortcut = toolShortcuts[event.key.toLowerCase()];

      if (
        shortcut === undefined ||
        (shortcut === 'crop' && workspace.view !== '3d') ||
        (shortcut === 'route' && state.source.terrain === undefined)
      ) {
        return;
      }

      event.preventDefault();
      c.workspace({ toolMode: getActiveTool(state) === shortcut ? 'none' : shortcut });
    };

    document.addEventListener('keydown', pressKey, true);

    return () => {
      document.removeEventListener('keydown', pressKey, true);
    };
  }, [c]);
}

/**
 * The crop frame over the 3D view. The model's source frame is the viewport captured when 3D
 * started, so the viewport size stands in for it; drags commit once per animation frame.
 */
function CropTool({
  controller: c,
  state,
  viewportSize,
}: {
  controller: StudioController;
  state: StudioState;
  viewportSize: { width: number; height: number };
}): ReactNode {
  const { dimensions, crop } = state.model;
  const isCircle = dimensions.cropShape === 'circle';
  const source: CropFrameSource = {
    ...viewportSize,
    aspectRatio: isCircle ? 1 : dimensions.widthMm / dimensions.lengthMm,
  };
  const dragStartCrop = useRef<TerrainCropSettings>(crop);
  const commitCrop = useFrameThrottledCropCommit(c);

  return (
    <CropFrame
      shape={isCircle ? 'circle' : 'rectangle'}
      planeAspectRatio={viewportSize.width / viewportSize.height}
      selection={getCropFractionBox(crop, source)}
      dimensionLabel={describeCropDimensions(dimensions, crop)}
      onDragStart={() => {
        dragStartCrop.current = c.getSnapshot().model.crop;
      }}
      onDrag={(handle, delta) => {
        commitCrop(resizeCrop(dragStartCrop.current, handle, delta, source));
      }}
      onHandleKey={(handle, key, isShiftPressed) => {
        const delta = getNudgeDelta(key, isShiftPressed);

        if (delta === undefined) {
          return false;
        }

        c.model({ crop: resizeCrop(c.getSnapshot().model.crop, handle, delta, source) });

        return true;
      }}
    />
  );
}

/** Click-drag, or two taps, places a line; endpoints drag. Points are located when placed. */
function MeasureTool({ hud }: { hud: HudStore }): ReactNode {
  const [measurement, setMeasurement] = useState<Measurement>({ kind: 'empty' });
  const gesture = useRef<{ down: PlacedPoint; isDrag: boolean } | undefined>(undefined);
  const place = (pointer: MeasurePointer): PlacedPoint => ({
    xPx: pointer.xPx,
    yPx: pointer.yPx,
    location: hud.locateClientPoint(pointer.clientX, pointer.clientY),
  });

  const handleSurface = (phase: 'down' | 'move' | 'up', pointer: MeasurePointer) => {
    if (phase === 'down') {
      gesture.current = { down: place(pointer), isDrag: false };

      return;
    }

    const current = gesture.current;

    if (current === undefined) {
      return;
    }

    const travelPx = Math.hypot(pointer.xPx - current.down.xPx, pointer.yPx - current.down.yPx);

    current.isDrag ||= travelPx > tapSlopPx;

    if (current.isDrag) {
      setMeasurement({ kind: 'measured', start: current.down, end: place(pointer) });
    }

    if (phase !== 'up') {
      return;
    }

    gesture.current = undefined;

    if (!current.isDrag) {
      setMeasurement((previous) =>
        previous.kind === 'anchored'
          ? { kind: 'measured', start: previous.start, end: current.down }
          : { kind: 'anchored', start: current.down },
      );
    }
  };

  const moveEndpoint = (endpoint: MeasureEndpoint, pointer: MeasurePointer) => {
    setMeasurement((previous) => {
      if (previous.kind === 'empty') {
        return previous;
      }

      if (previous.kind === 'anchored') {
        return { kind: 'anchored', start: place(pointer) };
      }

      return { ...previous, [endpoint]: place(pointer) };
    });
  };

  const start = measurement.kind === 'empty' ? undefined : measurement.start;
  const end = measurement.kind === 'measured' ? measurement.end : undefined;

  return (
    <MeasureLine
      start={start}
      end={end}
      onSurfacePointer={handleSurface}
      onEndpointMove={moveEndpoint}
    >
      {start !== undefined && end !== undefined && (
        <CalloutLabel
          anchor={{ xPx: (start.xPx + end.xPx) / 2, yPx: (start.yPx + end.yPx) / 2 }}
          {...describeMeasurement(start, end)}
        />
      )}
    </MeasureLine>
  );
}

function describeMeasurement(
  start: PlacedPoint,
  end: PlacedPoint,
): { value: string; meta: string[] } {
  if (start.location === undefined || end.location === undefined) {
    return { value: '—', meta: ['Off terrain'] };
  }

  const meters = distanceBetweenPlaces(start.location, end.location);
  const bearing = bearingDegrees(start.location, end.location);

  return {
    value: meters === undefined ? '—' : formatDistance(meters),
    meta: [bearing === undefined || meters === 0 ? '' : `Bearing ${formatBearing(bearing)}`],
  };
}

/** Keeps only the latest crop per animation frame, so a drag rebuilds the 3D model at most once a frame. */
function useFrameThrottledCropCommit(c: StudioController): (crop: TerrainCropSettings) => void {
  const pending = useRef<TerrainCropSettings | undefined>(undefined);
  const frame = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      if (frame.current !== undefined) {
        cancelAnimationFrame(frame.current);
      }
    },
    [],
  );

  return (crop: TerrainCropSettings) => {
    pending.current = crop;
    frame.current ??= requestAnimationFrame(() => {
      frame.current = undefined;

      if (pending.current !== undefined) {
        c.model({ crop: pending.current });
        pending.current = undefined;
      }
    });
  };
}

/** `150 × 150 mm · 80%`, or `⌀ 120 mm · 60%` for a circle, where the percentage is crop size. */
function describeCropDimensions(
  dimensions: StudioState['model']['dimensions'],
  crop: TerrainCropSettings,
): string {
  const footprint =
    dimensions.cropShape === 'circle'
      ? `⌀ ${String(dimensions.widthMm)}`
      : `${String(dimensions.widthMm)} × ${String(dimensions.lengthMm)}`;

  return `${footprint} mm · ${String(Math.round(crop.size * 100))}%`;
}

function isTextEntry(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest('input, textarea, select') !== null)
  );
}
