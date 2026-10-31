import type { KeyboardEvent, Ref } from 'react';

/** `closed` leaves only the handle showing, so the canvas gets the whole screen. */
export type SheetSnap = 'closed' | 'peek' | 'half' | 'full';

export interface SheetHandleProps {
  label?: string;
  snap: SheetSnap;
  onSnapChange: (snap: SheetSnap) => void;
  /** Id of the sheet element this handle resizes. */
  controlsId: string;
  ref?: Ref<HTMLButtonElement>;
}

const snapOrder: readonly SheetSnap[] = ['closed', 'peek', 'half', 'full'];

/** Keyboard-operable grabber for the bottom sheet (P-21). Dragging belongs to BottomSheet. */
export function SheetHandle({
  label = 'Resize sheet',
  snap,
  onSnapChange,
  controlsId,
  ref,
}: SheetHandleProps): React.JSX.Element {
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    const nextSnap = resolveNextSnap(snap, event.key);

    if (nextSnap === undefined) {
      return;
    }

    event.preventDefault();

    if (nextSnap !== snap) {
      onSnapChange(nextSnap);
    }
  }

  return (
    <button
      ref={ref}
      type="button"
      className="lc-sheet-handle"
      aria-label={label}
      aria-controls={controlsId}
      aria-valuetext={snap}
      aria-expanded={snap !== 'closed'}
      onKeyDown={handleKeyDown}
    >
      <span className="lc-sheet-handle__grabber" aria-hidden="true" />
    </button>
  );
}

// === HELPERS ===

/** Exported for tests. Returns undefined for keys the handle ignores, so the browser default still runs. */
export function resolveNextSnap(snap: SheetSnap, key: string): SheetSnap | undefined {
  const index = snapOrder.indexOf(snap);

  switch (key) {
    case 'ArrowUp':
      return snapOrder[Math.min(index + 1, snapOrder.length - 1)];
    case 'ArrowDown':
      return snapOrder[Math.max(index - 1, 0)];
    case 'Enter':
      // From closed, Enter opens to peek like a tap on the grip.
      return snap === 'closed' ? 'peek' : snap === 'half' ? 'full' : 'half';
    case 'Escape':
      return snap === 'peek' || snap === 'closed' ? 'closed' : 'peek';
    default:
      return undefined;
  }
}
