import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';

export type CropFrameShape = 'rectangle' | 'circle';
export type CropFrameHandle =
  'top-left' | 'top' | 'top-right' | 'right' | 'bottom-right' | 'bottom' | 'bottom-left' | 'left';

/** Fractions (0 to 1) of the source plane; +x east, +y south. */
export interface CropFrameBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropFrameProps {
  shape: CropFrameShape;
  /** Source width over height; the plane is fitted inside the frame box at this ratio. */
  planeAspectRatio: number;
  selection: CropFrameBox;
  /** Shown above the selection, e.g. `150 × 150 mm`. */
  dimensionLabel: string;
  /** A handle drag began; deltas that follow are measured from here. */
  onDragStart: (handle: CropFrameHandle) => void;
  /** Pointer travel since the drag began, in fractions of the plane. */
  onDrag: (handle: CropFrameHandle, delta: { x: number; y: number }) => void;
  /** A key on a focused handle; return true when it changed the crop. */
  onHandleKey: (handle: CropFrameHandle, key: string, isShiftPressed: boolean) => boolean;
}

const handles: readonly { handle: CropFrameHandle; label: string }[] = [
  { handle: 'top-left', label: 'Crop top-left corner' },
  { handle: 'top', label: 'Crop top edge' },
  { handle: 'top-right', label: 'Crop top-right corner' },
  { handle: 'right', label: 'Crop right edge' },
  { handle: 'bottom-right', label: 'Crop bottom-right corner' },
  { handle: 'bottom', label: 'Crop bottom edge' },
  { handle: 'bottom-left', label: 'Crop bottom-left corner' },
  { handle: 'left', label: 'Crop left edge' },
];

/**
 * On-canvas crop frame (O-04): the source plane fitted into the frame box, the selection with
 * rule-of-thirds lines and a dimension label, a darkened surround, and eight handles. Only the
 * handles take the pointer; they are sliders whose value is their edge's position in percent.
 */
export function CropFrame({
  shape,
  planeAspectRatio,
  selection,
  dimensionLabel,
  onDragStart,
  onDrag,
  onHandleKey,
}: CropFrameProps): React.JSX.Element {
  const plane = useRef<HTMLDivElement>(null);
  const drag = useRef<{ handle: CropFrameHandle; xPx: number; yPx: number } | undefined>(undefined);
  const style = {
    '--lc-crop-plane-ratio': String(planeAspectRatio),
    '--lc-crop-x': toPercent(selection.x),
    '--lc-crop-y': toPercent(selection.y),
    '--lc-crop-width': toPercent(selection.width),
    '--lc-crop-height': toPercent(selection.height),
  } as CSSProperties;

  const startDrag = (handle: CropFrameHandle, event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
    drag.current = { handle, xPx: event.clientX, yPx: event.clientY };
    onDragStart(handle);
  };

  const moveDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const bounds = plane.current?.getBoundingClientRect();

    if (drag.current === undefined || bounds === undefined || bounds.width === 0) {
      return;
    }

    onDrag(drag.current.handle, {
      x: (event.clientX - drag.current.xPx) / bounds.width,
      y: (event.clientY - drag.current.yPx) / bounds.height,
    });
  };

  const endDrag = () => {
    drag.current = undefined;
  };

  const pressKey = (handle: CropFrameHandle, event: KeyboardEvent<HTMLButtonElement>) => {
    if (onHandleKey(handle, event.key, event.shiftKey)) {
      event.preventDefault();
    }
  };

  return (
    <div className="lc-crop-frame" data-shape={shape} style={style}>
      <div ref={plane} className="lc-crop-frame__plane">
        <div className="lc-crop-frame__selection">
          <span className="lc-crop-frame__thirds" aria-hidden="true" />
          <span className="lc-crop-frame__label">{dimensionLabel}</span>
          {handles.map(({ handle, label }) => (
            <button
              key={handle}
              type="button"
              className="lc-crop-frame__handle"
              data-handle={handle}
              role="slider"
              aria-label={label}
              aria-orientation={handle === 'top' || handle === 'bottom' ? 'vertical' : 'horizontal'}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(getHandleValue(handle, selection))}
              aria-valuetext={describeHandle(handle, selection)}
              onPointerDown={(event) => {
                startDrag(handle, event);
              }}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onLostPointerCapture={endDrag}
              onKeyDown={(event) => {
                pressKey(handle, event);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// === HELPERS ===

/** Edges report their own position; corners report their horizontal edge. */
function getHandleValue(handle: CropFrameHandle, box: CropFrameBox): number {
  if (handle === 'top') {
    return box.y * 100;
  }

  if (handle === 'bottom') {
    return (box.y + box.height) * 100;
  }

  return handle.endsWith('left') ? box.x * 100 : (box.x + box.width) * 100;
}

function describeHandle(handle: CropFrameHandle, box: CropFrameBox): string {
  const horizontal = `${String(Math.round(getHandleValue(handle, box)))}%`;

  if (handle === 'top' || handle === 'bottom' || handle === 'left' || handle === 'right') {
    return horizontal;
  }

  const vertical = handle.startsWith('top') ? box.y : box.y + box.height;

  return `${horizontal} across, ${String(Math.round(vertical * 100))}% down`;
}

function toPercent(fraction: number): string {
  return `${String(Number((fraction * 100).toFixed(3)))}%`;
}
