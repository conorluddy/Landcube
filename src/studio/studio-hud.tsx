import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Compass } from '../ui/overlays/compass';
import { CoordinateTip } from '../ui/overlays/coordinate-tip';
import { Crosshair } from '../ui/overlays/crosshair';
import { HudFrame } from '../ui/overlays/hud-frame';
import { HudLayer } from '../ui/overlays/hud-layer';
import { ReadoutCard } from '../ui/overlays/readout-card';
import { ScaleBar } from '../ui/overlays/scale-bar';
import type { StudioState } from './controller';
import { getFrameMetersPerPixel } from './hud-location';
import {
  chooseScaleBar,
  describeCameraReadouts,
  describeContourReadout,
  describeTarget,
  formatMapLocation,
  getCanvasTone,
} from './hud-readouts';
import type { HudStore } from './hud-store';

/** The card needs a desktop-sized viewport: wider than a phone and at least 700px tall. */
const readoutCardQuery = '(min-width: 768px) and (min-height: 700px)';
/** Inside the card's 300px less its 14px side padding. */
const cardScaleBarMaximumPx = 272;
const canvasScaleBarMaximumPx = 120;

/**
 * Canvas overlays for the studio: HUD frame, crosshair with coordinate tip, compass, scale bar
 * and the Target lock card. Pointer and relief come from the HUD store; everything else from state.
 */
export function StudioHud({ state, hud }: { state: StudioState; hud: HudStore }): ReactNode {
  const { pointer, generatedReliefMeters } = useSyncExternalStore(hud.subscribe, hud.getSnapshot);
  const isReadoutCardShown = useSyncExternalStore(
    subscribeToReadoutCardQuery,
    readReadoutCardQuery,
  );
  const layer = useRef<HTMLDivElement>(null);
  const viewportSize = useElementSize(layer);
  const is3d = state.workspace.view === '3d';
  const target = describeTarget(state, generatedReliefMeters);
  // Perspective has no single map scale, so only the 2D plan shows a scale bar.
  const metersPerPixel =
    is3d || viewportSize === undefined
      ? undefined
      : getFrameMetersPerPixel(viewportSize, state.source.terrain);
  const cardScaleBar =
    metersPerPixel === undefined
      ? undefined
      : chooseScaleBar(metersPerPixel, cardScaleBarMaximumPx);
  const canvasScaleBar =
    metersPerPixel === undefined || isReadoutCardShown
      ? undefined
      : chooseScaleBar(metersPerPixel, canvasScaleBarMaximumPx);

  return (
    <HudLayer
      ref={layer}
      canvasTone={getCanvasTone(state)}
      inspectorState={state.workspace.collapsed ? 'collapsed' : 'expanded'}
      pointer={
        <Crosshair position={pointer.kind === 'tracking' ? pointer : undefined}>
          {pointer.kind === 'tracking' && pointer.location !== undefined && (
            <CoordinateTip lines={formatMapLocation(pointer.location)} />
          )}
        </Crosshair>
      }
      frame={
        <HudFrame
          readouts={describeCameraReadouts(state)}
          trailingReadout={describeContourReadout(state)}
        />
      }
      instruments={
        <>
          {canvasScaleBar && <ScaleBar {...canvasScaleBar} />}
          <Compass headingDegrees={is3d ? (state.cameraPose?.azimuthDegrees ?? 0) : 0} />
        </>
      }
      readout={<ReadoutCard {...target} scaleBar={cardScaleBar} isHidden={!isReadoutCardShown} />}
    />
  );
}

function useElementSize(
  element: React.RefObject<HTMLElement | null>,
): { width: number; height: number } | undefined {
  const [size, setSize] = useState<{ width: number; height: number }>();

  useEffect(() => {
    const observed = element.current;

    if (!observed) {
      return;
    }

    const observer = new ResizeObserver(() => {
      setSize({ width: observed.clientWidth, height: observed.clientHeight });
    });

    observer.observe(observed);

    return () => {
      observer.disconnect();
    };
  }, [element]);

  return size;
}

function subscribeToReadoutCardQuery(onChange: () => void): () => void {
  const query = matchMedia(readoutCardQuery);

  query.addEventListener('change', onChange);

  return () => {
    query.removeEventListener('change', onChange);
  };
}

function readReadoutCardQuery(): boolean {
  return matchMedia(readoutCardQuery).matches;
}
