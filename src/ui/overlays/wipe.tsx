import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { Tag } from '../tag';
import type { HudInspectorState } from './hud-layer';

export interface WipeProps {
  /** A standalone SVG document for side B, drawn from the left edge but visible only right of the divider. */
  sideBMarkup: string;
  /** Side B's canvas colour, so a transparent design cannot show side A through. */
  sideBBackground: string;
  /** Divider position across the overlay, 0 to 1. The caller clamps. */
  dividerFraction: number;
  onDividerChange: (fraction: number) => void;
  /** Keeps the A and B tags clear of the inspector. */
  inspectorState: HudInspectorState;
  /** False while previewing: the divider shows but cannot be moved. */
  isInteractive?: boolean;
}

const arrowStep = 0.02;
const shiftArrowStep = 0.1;

/**
 * A/B wipe (O-08): side A is the live viewport underneath; side B is clipped to the right of a
 * divider. Pointer-transparent except for the handle.
 */
export function Wipe({
  sideBMarkup,
  sideBBackground,
  dividerFraction,
  onDividerChange,
  inspectorState,
  isInteractive = true,
}: WipeProps): React.JSX.Element {
  const overlay = useRef<HTMLDivElement>(null);

  const moveToPointer = (event: PointerEvent<HTMLDivElement>): void => {
    const bounds = overlay.current?.getBoundingClientRect();

    if (bounds && bounds.width > 0) {
      onDividerChange((event.clientX - bounds.left) / bounds.width);
    }
  };

  const moveByKey = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step = event.shiftKey ? shiftArrowStep : arrowStep;
    const nextFraction =
      event.key === 'ArrowLeft' || event.key === 'ArrowDown'
        ? dividerFraction - step
        : event.key === 'ArrowRight' || event.key === 'ArrowUp'
          ? dividerFraction + step
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? 1
              : undefined;

    if (nextFraction === undefined) {
      return;
    }

    event.preventDefault();
    onDividerChange(nextFraction);
  };

  return (
    <div
      ref={overlay}
      className="lc-wipe"
      data-wipe
      data-inspector={inspectorState}
      style={{ '--lc-wipe-position': `${String(dividerFraction * 100)}%` } as React.CSSProperties}
    >
      <div
        className="lc-wipe__side-b"
        data-wipe-side-b
        aria-hidden="true"
        style={{ background: sideBBackground }}
        dangerouslySetInnerHTML={{ __html: sideBMarkup }}
      />
      <span className="lc-wipe__tag" data-side="a">
        <Tag variant="outlineBone">A</Tag>
      </span>
      <span className="lc-wipe__tag" data-side="b">
        <Tag variant="outlineBone">B</Tag>
      </span>
      <div className="lc-wipe__divider" aria-hidden="true" />
      {isInteractive && (
        <div
          className="lc-wipe__handle"
          role="slider"
          tabIndex={0}
          aria-label="Compare divider"
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(dividerFraction * 100)}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            moveToPointer(event);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              moveToPointer(event);
            }
          }}
          onKeyDown={moveByKey}
        >
          <span aria-hidden="true">◂ ▸</span>
        </div>
      )}
    </div>
  );
}
