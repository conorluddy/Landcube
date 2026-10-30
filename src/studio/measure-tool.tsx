import { useRef, useState, type ReactNode } from 'react';
import type { RealTerrain } from '../real-terrain';
import { CalloutLabel } from '../ui/overlays/callout-label';
import {
  MeasureLine,
  type MeasureEndpoint,
  type MeasurePointer,
} from '../ui/overlays/measure-line';
import type { HudStore, MapLocation } from './hud-store';
import { describeMeasurement } from './tool-state';
import { useProjectionRevision } from './use-projection-revision';

/**
 * Endpoints are terrain coordinates, not pixels: every render projects them again, so they stay on
 * the same ground when the 3D camera orbits (REQ-6).
 */
type Measurement =
  | { kind: 'empty' }
  | { kind: 'anchored'; start: MapLocation }
  | { kind: 'measured'; start: MapLocation; end: MapLocation };

/** Pointer travel below this is a tap that places one endpoint, not a drag. */
const tapSlopPx = 4;

// === PUBLIC API ===

/** Click-drag, or two taps, places a line; endpoints drag. A pointer over sky places nothing. */
export function MeasureTool({
  hud,
  terrain,
}: {
  hud: HudStore;
  terrain: Pick<RealTerrain, 'sourceElevations'> | undefined;
}): ReactNode {
  useProjectionRevision(hud);
  const [measurement, setMeasurement] = useState<Measurement>({ kind: 'empty' });
  const gesture = useRef<
    { xPx: number; yPx: number; location: MapLocation | undefined; isDrag: boolean } | undefined
  >(undefined);
  const locate = (pointer: MeasurePointer) =>
    hud.locateClientPoint(pointer.clientX, pointer.clientY);

  const handleSurface = (phase: 'down' | 'move' | 'up', pointer: MeasurePointer) => {
    if (phase === 'down') {
      gesture.current = {
        xPx: pointer.xPx,
        yPx: pointer.yPx,
        location: locate(pointer),
        isDrag: false,
      };

      return;
    }

    const current = gesture.current;

    if (current === undefined) {
      return;
    }

    current.isDrag ||= Math.hypot(pointer.xPx - current.xPx, pointer.yPx - current.yPx) > tapSlopPx;
    const end = current.isDrag ? locate(pointer) : undefined;

    if (current.location !== undefined && end !== undefined) {
      setMeasurement({ kind: 'measured', start: current.location, end });
    }

    if (phase !== 'up') {
      return;
    }

    gesture.current = undefined;

    if (!current.isDrag && current.location !== undefined) {
      const placed = current.location;

      setMeasurement((previous) =>
        previous.kind === 'anchored'
          ? { kind: 'measured', start: previous.start, end: placed }
          : { kind: 'anchored', start: placed },
      );
    }
  };

  const moveEndpoint = (endpoint: MeasureEndpoint, pointer: MeasurePointer) => {
    const location = locate(pointer);

    if (location === undefined) {
      return;
    }

    setMeasurement((previous) => {
      if (previous.kind === 'empty') {
        return previous;
      }

      return previous.kind === 'anchored'
        ? { kind: 'anchored', start: location }
        : { ...previous, [endpoint]: location };
    });
  };

  const startLocation = measurement.kind === 'empty' ? undefined : measurement.start;
  const endLocation = measurement.kind === 'measured' ? measurement.end : undefined;
  const start = startLocation && hud.projectLocation(startLocation);
  const end = endLocation && hud.projectLocation(endLocation);

  return (
    <MeasureLine
      start={start}
      end={end}
      onSurfacePointer={handleSurface}
      onEndpointMove={moveEndpoint}
    >
      {startLocation !== undefined && endLocation !== undefined && start && end && (
        <CalloutLabel
          anchor={{ xPx: (start.xPx + end.xPx) / 2, yPx: (start.yPx + end.yPx) / 2 }}
          {...describeMeasurement(startLocation, endLocation, (point) =>
            terrain?.sourceElevations?.sampleMeters(point),
          )}
        />
      )}
    </MeasureLine>
  );
}
