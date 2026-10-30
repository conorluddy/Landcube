import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react';

/** A point relative to the overlay. */
export interface RouteEditorPoint {
  xPx: number;
  yPx: number;
}

/** An overlay point plus its viewport position, so the host can locate it on the terrain. */
export interface RouteEditorPointer extends RouteEditorPoint {
  clientX: number;
  clientY: number;
}

export interface RouteEditorProps {
  /**
   * Waypoints in travel order, already projected into the overlay. Undefined where the view
   * cannot place a point (3D has no projector yet); those get no handle.
   */
  points: readonly (RouteEditorPoint | undefined)[];
  selectedIndex?: number;
  /** True while drawing: the open canvas takes the pointer so a tap places a waypoint. */
  isPlacing: boolean;
  /** Pointer phases over the open canvas; only sent while `isPlacing`. */
  onSurfacePointer: (phase: 'down' | 'up', pointer: RouteEditorPointer) => void;
  onSelect: (index: number) => void;
  /** A handle was dragged to `pointer`. */
  onMove: (index: number, pointer: RouteEditorPointer) => void;
  /** The target between waypoint `segmentIndex` and the next was activated. */
  onInsert: (segmentIndex: number) => void;
  /** Floating controls and labels for the host. */
  children?: ReactNode;
}

/**
 * Route editor (O-09): numbered waypoint handles with the start as a square and the end as a
 * diamond, a small insert target at every segment midpoint, and the selected handle ringed. The
 * route line itself is `RouteLine`'s. Only the handles, targets and, while placing, the surface
 * take the pointer.
 */
export function RouteEditor({
  points,
  selectedIndex,
  isPlacing,
  onSurfacePointer,
  onSelect,
  onMove,
  onInsert,
  children,
}: RouteEditorProps): React.JSX.Element {
  const root = useRef<HTMLDivElement>(null);
  const draggingIndex = useRef<number | undefined>(undefined);

  const toPointer = (clientX: number, clientY: number): RouteEditorPointer => {
    const bounds = root.current?.getBoundingClientRect();

    return {
      xPx: clientX - (bounds?.left ?? 0),
      yPx: clientY - (bounds?.top ?? 0),
      clientX,
      clientY,
    };
  };

  const startDrag = (index: number, event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingIndex.current = index;
    onSelect(index);
  };

  const endDrag = () => {
    draggingIndex.current = undefined;
  };

  const lastIndex = points.length - 1;

  return (
    <div ref={root} className="lc-route-editor">
      {isPlacing && (
        <div
          className="lc-route-editor__surface"
          onPointerDown={(event) => {
            if (event.button === 0) {
              event.preventDefault();
              event.stopPropagation();
              onSurfacePointer('down', toPointer(event.clientX, event.clientY));
            }
          }}
          onPointerUp={(event) => {
            onSurfacePointer('up', toPointer(event.clientX, event.clientY));
          }}
        />
      )}
      {points.map((from, index) => {
        const to = points[index + 1];

        return (
          from !== undefined &&
          to !== undefined && (
            <button
              key={`insert-${String(index)}`}
              type="button"
              className="lc-route-editor__insert"
              aria-label={`Insert waypoint after ${String(index + 1)}`}
              style={place({ xPx: (from.xPx + to.xPx) / 2, yPx: (from.yPx + to.yPx) / 2 })}
              onClick={() => {
                onInsert(index);
              }}
            />
          )
        );
      })}
      {points.map(
        (point, index) =>
          point !== undefined && (
            <button
              key={`handle-${String(index)}`}
              type="button"
              className="lc-route-editor__handle"
              data-route-handle={index}
              data-end={index === 0 ? 'start' : index === lastIndex ? 'end' : undefined}
              aria-label={`Waypoint ${String(index + 1)}`}
              aria-pressed={index === selectedIndex}
              style={place(point)}
              onPointerDown={(event) => {
                startDrag(index, event);
              }}
              onPointerMove={(event) => {
                if (draggingIndex.current === index) {
                  onMove(index, toPointer(event.clientX, event.clientY));
                }
              }}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onLostPointerCapture={endDrag}
              onClick={() => {
                onSelect(index);
              }}
            >
              <span aria-hidden="true">{index + 1}</span>
            </button>
          ),
      )}
      {children}
    </div>
  );
}

// === HELPERS ===

function place(point: RouteEditorPoint): CSSProperties {
  return {
    '--lc-route-editor-x': `${String(Math.round(point.xPx))}px`,
    '--lc-route-editor-y': `${String(Math.round(point.yPx))}px`,
  } as CSSProperties;
}
