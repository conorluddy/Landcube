import { useRef, useState, type PointerEvent } from 'react';
import type { StudioController } from './controller';
import './walk-drop.css';

/** Movement past this many pixels turns a press into a drag. */
const dragThresholdPx = 4;

/** Spike: drag the walker onto the model to drop into first person there; a click walks from the centre. */
export function WalkDrop({ controller }: { controller: StudioController }): React.JSX.Element {
  const pressedAt = useRef<{ x: number; y: number } | undefined>(undefined);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number }>();
  const [hasMissed, setHasMissed] = useState(false);

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    pressedAt.current = { x: event.clientX, y: event.clientY };
    setHasMissed(false);
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const start = pressedAt.current;

    if (!start) {
      return;
    }

    const isDragging =
      dragPoint !== undefined ||
      Math.hypot(event.clientX - start.x, event.clientY - start.y) > dragThresholdPx;

    if (isDragging) {
      setDragPoint({ x: event.clientX, y: event.clientY });
    }
  };

  const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const wasDragging = dragPoint !== undefined;

    pressedAt.current = undefined;
    setDragPoint(undefined);

    // Called inside the pointerup so the walk's pointer lock request counts as a user gesture.
    if (wasDragging) {
      setHasMissed(!controller.walkAt(event.clientX, event.clientY));
    } else if (event.pointerType !== 'mouse' || event.button === 0) {
      controller.walkAt();
    }
  };

  return (
    <>
      <button
        className="walk-drop"
        type="button"
        aria-label="Walk the landscape: drag onto the model, or press to walk from the centre"
        title="Drag onto the model to walk there"
        data-missed={hasMissed ? 'true' : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          pressedAt.current = undefined;
          setDragPoint(undefined);
        }}
        onAnimationEnd={() => {
          setHasMissed(false);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            controller.walkAt();
          }
        }}
      >
        <WalkerIcon />
      </button>
      {dragPoint && (
        <div className="walk-drop__ghost" style={{ left: dragPoint.x, top: dragPoint.y }}>
          <WalkerIcon />
        </div>
      )}
    </>
  );
}

function WalkerIcon(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="13" cy="4" r="1.8" />
      <path d="M12.5 8 10.5 14l3 2.5V21" />
      <path d="M10.5 14 8 21" />
      <path d="M12.5 8 9 10l-1 3" />
      <path d="M12.5 8l2 3 2.5 1" />
    </svg>
  );
}
