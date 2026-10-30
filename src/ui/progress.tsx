import type { CSSProperties } from 'react';

export interface ProgressProps {
  /** 0 to 1. NaN becomes 0; out-of-range values clamp. */
  fraction: number;
  label: string;
  isIndeterminate?: boolean;
}

/** Thin progress bar (P-18). Indeterminate omits aria-valuenow. */
export function Progress({
  fraction,
  label,
  isIndeterminate = false,
}: ProgressProps): React.JSX.Element {
  const clampedFraction = clampFraction(fraction);

  return (
    <div
      className="lc-progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={isIndeterminate ? undefined : clampedFraction}
      data-indeterminate={isIndeterminate ? 'true' : undefined}
      style={{ '--lc-progress-fraction': clampedFraction } as CSSProperties}
    >
      <span className="lc-progress__fill" />
    </div>
  );
}

// === HELPERS ===

function clampFraction(fraction: number): number {
  if (Number.isNaN(fraction)) {
    return 0;
  }

  return Math.min(1, Math.max(0, fraction));
}
