import type { SheetSnap } from './sheet-handle';

/** Sheet heights in px for each snap, measured against the sheet's container. */
export type SheetSnapHeights = Readonly<Record<SheetSnap, number>>;

/** A release faster than this (px/ms) snaps one step in the drag direction instead of to the nearest. */
export const flickVelocityPxPerMs = 0.5;
/** Half is about 50% in the design; 55% keeps it under the 62% the mobile e2e test allows. */
export const halfSnapFraction = 0.55;

const snapOrder: readonly SheetSnap[] = ['closed', 'peek', 'half', 'full'];

// === PUBLIC API ===

/**
 * Picks the snap a released drag settles on. `positionPx` is the sheet height at release;
 * `velocityPxPerMs` is positive while the sheet grows (dragged up).
 */
export function pickSnap(
  positionPx: number,
  velocityPxPerMs: number,
  heights: SheetSnapHeights,
): SheetSnap {
  if (Math.abs(velocityPxPerMs) > flickVelocityPxPerMs) {
    return velocityPxPerMs > 0
      ? nextSnapAbove(positionPx, heights)
      : nextSnapBelow(positionPx, heights);
  }

  return snapOrder.reduce((nearest, snap) =>
    Math.abs(heights[snap] - positionPx) < Math.abs(heights[nearest] - positionPx) ? snap : nearest,
  );
}

/** Snap heights for a container `containerHeightPx` tall, mirroring the CSS in bottom-sheet.css. */
export function measureSnapHeights(
  containerHeightPx: number,
  peekHeightPx: number,
  fullTopInsetPx: number,
  /** The grip's laid-out height: a closed sheet is the grip alone (`--lc-h-s`). */
  closedHeightPx: number,
): SheetSnapHeights {
  const full = Math.max(containerHeightPx - fullTopInsetPx, peekHeightPx);

  return {
    closed: Math.min(closedHeightPx, peekHeightPx),
    peek: peekHeightPx,
    half: Math.min(Math.max(containerHeightPx * halfSnapFraction, peekHeightPx), full),
    full,
  };
}

// === HELPERS ===

function nextSnapAbove(positionPx: number, heights: SheetSnapHeights): SheetSnap {
  return snapOrder.find((snap) => heights[snap] > positionPx) ?? 'full';
}

function nextSnapBelow(positionPx: number, heights: SheetSnapHeights): SheetSnap {
  return [...snapOrder].reverse().find((snap) => heights[snap] < positionPx) ?? 'closed';
}
