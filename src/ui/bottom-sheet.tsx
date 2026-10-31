import { useId, useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { measureSnapHeights, pickSnap, type SheetSnapHeights } from './bottom-sheet-snap';
import { SheetHandle, type SheetSnap } from './sheet-handle';

export type BottomSheetElement = 'aside' | 'section' | 'div';

export interface BottomSheetProps {
  snap: SheetSnap;
  onSnapChange: (snap: SheetSnap) => void;
  peekHeightPx?: number;
  /** Gap left above the sheet at `full`. */
  fullTopInsetPx?: number;
  /** Row under the handle that stays visible at every snap (readouts, primary action). */
  peek?: ReactNode;
  /** Pinned above the scrolling body, e.g. the section tab strip. */
  header?: ReactNode;
  children: ReactNode;
  id?: string;
  /** Accessible name; a named `aside` is a complementary landmark. */
  label: string;
  as?: BottomSheetElement;
}

interface DragSample {
  pointerId: number;
  startY: number;
  startHeightPx: number;
  lastY: number;
  lastTimeMs: number;
  velocityPxPerMs: number;
  heights: SheetSnapHeights;
}

/** Below this travel a press on the handle is a tap, not a drag. */
const dragThresholdPx = 4;

/**
 * Four-snap bottom sheet (C-14), pinned to the bottom of its containing block: heights resolve
 * against that block (closed is the handle alone, peek `peekHeightPx`, half 55%, full less `fullTopInsetPx`). The handle drags
 * by pointer, steps by keyboard and reopens on a tap when closed; the body scrolls at half and full.
 */
export function BottomSheet({
  snap,
  onSnapChange,
  peekHeightPx = 190,
  fullTopInsetPx = 64,
  peek,
  header,
  children,
  id,
  label,
  as: Element = 'aside',
}: BottomSheetProps): React.JSX.Element {
  const generatedId = useId();
  const sheetId = id ?? generatedId;
  const sheetRef = useRef<HTMLElement | null>(null);
  const drag = useRef<DragSample | null>(null);
  const handleRef = useRef<HTMLButtonElement | null>(null);

  // Closing makes the content inert, which would drop focus held inside it to <body>.
  const changeSnap = (nextSnap: SheetSnap): void => {
    const sheet = sheetRef.current;

    if (nextSnap === 'closed' && sheet?.contains(document.activeElement) === true) {
      handleRef.current?.focus();
    }

    onSnapChange(nextSnap);
  };

  const startDrag = (event: PointerEvent<HTMLDivElement>): void => {
    const sheet = sheetRef.current;

    if (!sheet || !event.isPrimary || event.button !== 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeightPx: sheet.getBoundingClientRect().height,
      lastY: event.clientY,
      lastTimeMs: event.timeStamp,
      velocityPxPerMs: 0,
      heights: measureSnapHeights(
        sheet.parentElement?.clientHeight ?? window.innerHeight,
        peekHeightPx,
        fullTopInsetPx,
        readClosedHeightPx(sheet),
      ),
    };
  };

  const followPointer = (event: PointerEvent<HTMLDivElement>): void => {
    const sample = drag.current;
    const sheet = sheetRef.current;

    if (!sample || !sheet || sample.pointerId !== event.pointerId) {
      return;
    }

    const elapsedMs = event.timeStamp - sample.lastTimeMs;

    if (elapsedMs > 0) {
      sample.velocityPxPerMs = (sample.lastY - event.clientY) / elapsedMs;
    }

    sample.lastY = event.clientY;
    sample.lastTimeMs = event.timeStamp;

    const isDragging = sheet.dataset.dragging !== undefined;

    if (!isDragging && Math.abs(event.clientY - sample.startY) < dragThresholdPx) {
      return;
    }

    sheet.dataset.dragging = 'true';
    sheet.style.height = `${String(clampDragHeight(sample, event.clientY))}px`;
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>, isCancelled: boolean): void => {
    const sample = drag.current;
    const sheet = sheetRef.current;

    if (!sample || !sheet || sample.pointerId !== event.pointerId) {
      return;
    }

    drag.current = null;

    if (sheet.dataset.dragging === undefined) {
      // Pointer capture retargets the tap's click to the grip, so the closed notch reopens here.
      if (!isCancelled && snap === 'closed') {
        changeSnap('peek');
      }

      return;
    }

    const releaseHeightPx = clampDragHeight(sample, event.clientY);
    // A pause before release leaves a stale velocity; only a recent move counts as a flick.
    const velocityPxPerMs = event.timeStamp - sample.lastTimeMs > 100 ? 0 : sample.velocityPxPerMs;
    const nextSnap = isCancelled
      ? snap
      : pickSnap(releaseHeightPx, velocityPxPerMs, sample.heights);

    delete sheet.dataset.dragging;
    sheet.style.removeProperty('height');

    if (nextSnap !== snap) {
      changeSnap(nextSnap);
    }
  };

  const isClosed = snap === 'closed';
  const sizeVariables = {
    '--lc-sheet-peek-height': `${String(peekHeightPx)}px`,
    '--lc-sheet-full-inset': `${String(fullTopInsetPx)}px`,
  } as CSSProperties;

  return (
    <Element
      ref={(element: HTMLElement | null) => {
        sheetRef.current = element;
      }}
      id={sheetId}
      className="lc-bottom-sheet lc-glass"
      data-snap={snap}
      data-ui-surface
      aria-label={label}
      style={sizeVariables}
    >
      <div
        className="lc-bottom-sheet__grip"
        onPointerDown={startDrag}
        onPointerMove={followPointer}
        onPointerUp={(event) => {
          endDrag(event, false);
        }}
        onPointerCancel={(event) => {
          endDrag(event, true);
        }}
      >
        <SheetHandle ref={handleRef} snap={snap} onSnapChange={changeSnap} controlsId={sheetId} />
      </div>
      {/* A closed sheet only clips its content, so inert keeps Tab off the hidden controls. */}
      {peek !== undefined && (
        <div className="lc-bottom-sheet__peek" inert={isClosed}>
          {peek}
        </div>
      )}
      {header !== undefined && (
        <div className="lc-bottom-sheet__header" inert={isClosed}>
          {header}
        </div>
      )}
      <div className="lc-bottom-sheet__body" inert={isClosed}>
        {children}
      </div>
    </Element>
  );
}

// === HELPERS ===

function clampDragHeight(sample: DragSample, clientY: number): number {
  const heightPx = sample.startHeightPx + sample.startY - clientY;

  return Math.min(Math.max(heightPx, sample.heights.closed), sample.heights.full);
}

/** The closed height is the `--lc-h-l` token bottom-sheet.css sizes a closed sheet with. */
function readClosedHeightPx(sheet: HTMLElement): number {
  return Number.parseFloat(getComputedStyle(sheet).getPropertyValue('--lc-h-l')) || 44;
}
