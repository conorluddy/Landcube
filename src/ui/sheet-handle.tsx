import type { KeyboardEvent, Ref } from 'react';

export type SheetSnap = 'peek' | 'half' | 'full';

export interface SheetHandleProps {
  label?: string;
  snap: SheetSnap;
  onSnapChange: (snap: SheetSnap) => void;
  /** Id of the sheet element this handle resizes. */
  controlsId: string;
  ref?: Ref<HTMLButtonElement>;
}

const snapOrder: readonly SheetSnap[] = ['peek', 'half', 'full'];

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
      onKeyDown={handleKeyDown}
    >
      <span className="lc-sheet-handle__grabber" aria-hidden="true" />
    </button>
  );
}

// === HELPERS ===

/** Returns undefined for keys the handle ignores, so the browser default still runs. */
function resolveNextSnap(snap: SheetSnap, key: string): SheetSnap | undefined {
  const index = snapOrder.indexOf(snap);

  switch (key) {
    case 'ArrowUp':
      return snapOrder[Math.min(index + 1, snapOrder.length - 1)];
    case 'ArrowDown':
      return snapOrder[Math.max(index - 1, 0)];
    case 'Enter':
      return snap === 'half' ? 'full' : 'half';
    case 'Escape':
      return 'peek';
    default:
      return undefined;
  }
}
