import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react';

export type MeasureEndpoint = 'start' | 'end';

/** A point relative to the overlay. */
export interface MeasurePoint {
  xPx: number;
  yPx: number;
}

/** An overlay point plus its viewport position, so the host can locate it on the terrain. */
export interface MeasurePointer extends MeasurePoint {
  clientX: number;
  clientY: number;
}

export type MeasureGesturePhase = 'down' | 'move' | 'up';

export interface MeasureLineProps {
  start?: MeasurePoint;
  end?: MeasurePoint;
  /** Usually a CalloutLabel at the line's midpoint. */
  children?: ReactNode;
  /** Pointer phases over the open canvas while measuring; the host turns them into endpoints. */
  onSurfacePointer: (phase: MeasureGesturePhase, pointer: MeasurePointer) => void;
  /** An endpoint was dragged or nudged with the arrow keys to `pointer`. */
  onEndpointMove: (endpoint: MeasureEndpoint, pointer: MeasurePointer) => void;
}

const tickCount = 10;
const tickLengthPx = 6;
const capLengthPx = 12;
const keyStepPx = 1;
const shiftKeyStepPx = 10;
const keySteps: Partial<Record<string, MeasurePoint>> = {
  ArrowLeft: { xPx: -1, yPx: 0 },
  ArrowRight: { xPx: 1, yPx: 0 },
  ArrowUp: { xPx: 0, yPx: -1 },
  ArrowDown: { xPx: 0, yPx: 1 },
};

/**
 * Measure line (O-05): a full-bleed surface that takes the pointer while measuring, a bone line on
 * an ink halo with ticks at every tenth, end caps, and two draggable endpoints. The surface and
 * endpoints are the only parts with pointer events.
 */
export function MeasureLine({
  start,
  end,
  children,
  onSurfacePointer,
  onEndpointMove,
}: MeasureLineProps): React.JSX.Element {
  const root = useRef<HTMLDivElement>(null);
  const dragging = useRef<MeasureEndpoint | 'surface' | undefined>(undefined);

  const toPointer = (clientX: number, clientY: number): MeasurePointer => {
    const bounds = root.current?.getBoundingClientRect();

    return {
      xPx: clientX - (bounds?.left ?? 0),
      yPx: clientY - (bounds?.top ?? 0),
      clientX,
      clientY,
    };
  };

  const capture = (
    target: MeasureEndpoint | 'surface',
    event: PointerEvent<HTMLElement>,
  ): boolean => {
    if (event.button !== 0) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = target;

    return true;
  };

  const release = () => {
    dragging.current = undefined;
  };

  return (
    <div ref={root} className="lc-measure-line">
      <div
        className="lc-measure-line__surface"
        onPointerDown={(event) => {
          if (capture('surface', event)) {
            onSurfacePointer('down', toPointer(event.clientX, event.clientY));
          }
        }}
        onPointerMove={(event) => {
          if (dragging.current === 'surface') {
            onSurfacePointer('move', toPointer(event.clientX, event.clientY));
          }
        }}
        onPointerUp={(event) => {
          if (dragging.current === 'surface') {
            release();
            onSurfacePointer('up', toPointer(event.clientX, event.clientY));
          }
        }}
        onPointerCancel={release}
      />
      {start !== undefined && (
        <svg className="lc-measure-line__drawing" aria-hidden="true">
          {end !== undefined && <MeasureStroke start={start} end={end} />}
        </svg>
      )}
      {(
        [
          ['start', start],
          ['end', end],
        ] as const
      ).map(
        ([endpoint, point]) =>
          point !== undefined && (
            <button
              key={endpoint}
              type="button"
              className="lc-measure-line__endpoint"
              data-endpoint={endpoint}
              aria-label={endpoint === 'start' ? 'Measure start' : 'Measure end'}
              style={
                {
                  '--lc-measure-x': `${String(Math.round(point.xPx))}px`,
                  '--lc-measure-y': `${String(Math.round(point.yPx))}px`,
                } as CSSProperties
              }
              onPointerDown={(event) => {
                capture(endpoint, event);
              }}
              onPointerMove={(event) => {
                if (dragging.current === endpoint) {
                  onEndpointMove(endpoint, toPointer(event.clientX, event.clientY));
                }
              }}
              onPointerUp={release}
              onPointerCancel={release}
              onLostPointerCapture={release}
              onKeyDown={(event) => {
                const step = keySteps[event.key];
                const bounds = root.current?.getBoundingClientRect();

                if (step === undefined) {
                  return;
                }

                event.preventDefault();
                const distancePx = event.shiftKey ? shiftKeyStepPx : keyStepPx;

                onEndpointMove(
                  endpoint,
                  toPointer(
                    (bounds?.left ?? 0) + point.xPx + step.xPx * distancePx,
                    (bounds?.top ?? 0) + point.yPx + step.yPx * distancePx,
                  ),
                );
              }}
            />
          ),
      )}
      {children}
    </div>
  );
}

// === HELPERS ===

/** Halo, line, a tick every tenth of the length and caps at both ends, all perpendicular. */
function MeasureStroke({ start, end }: { start: MeasurePoint; end: MeasurePoint }): ReactNode {
  const lengthPx = Math.hypot(end.xPx - start.xPx, end.yPx - start.yPx);

  if (lengthPx === 0) {
    return null;
  }

  const normal = {
    xPx: -(end.yPx - start.yPx) / lengthPx,
    yPx: (end.xPx - start.xPx) / lengthPx,
  };
  const ticks = Array.from({ length: tickCount + 1 }, (_, index) => {
    const along = index / tickCount;
    const halfPx = (index === 0 || index === tickCount ? capLengthPx : tickLengthPx) / 2;
    const xPx = start.xPx + (end.xPx - start.xPx) * along;
    const yPx = start.yPx + (end.yPx - start.yPx) * along;

    return `M ${round(xPx - normal.xPx * halfPx)} ${round(yPx - normal.yPx * halfPx)} L ${round(xPx + normal.xPx * halfPx)} ${round(yPx + normal.yPx * halfPx)}`;
  }).join(' ');
  const line = `M ${round(start.xPx)} ${round(start.yPx)} L ${round(end.xPx)} ${round(end.yPx)}`;

  return (
    <>
      <path className="lc-measure-line__halo" d={`${line} ${ticks}`} />
      <path className="lc-measure-line__stroke" d={`${line} ${ticks}`} />
    </>
  );
}

function round(value: number): string {
  return String(Math.round(value * 10) / 10);
}
