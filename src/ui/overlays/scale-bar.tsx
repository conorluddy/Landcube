import type { CSSProperties } from 'react';

export interface ScaleBarProps {
  /** Ground distance the whole bar spans. */
  totalKm: number;
  /** On-screen length of `totalKm`; the caller derives it from the map scale. */
  lengthPx: number;
}

/** Four alternating 4px segments with 0 / half / total km ticks (O-07). */
export function ScaleBar({ totalKm, lengthPx }: ScaleBarProps): React.JSX.Element {
  const total = formatKilometres(totalKm);

  return (
    <div
      className="lc-scale-bar"
      role="img"
      aria-label={`Scale bar, ${total} km`}
      style={{ '--lc-scale-bar-length': `${lengthPx}px` } as CSSProperties}
    >
      <span className="lc-scale-bar__segments" />
      <span className="lc-scale-bar__ticks" aria-hidden="true">
        <span>0</span>
        <span>{formatKilometres(totalKm / 2)}</span>
        <span>{total} km</span>
      </span>
    </div>
  );
}

function formatKilometres(value: number): string {
  return String(Number(value.toPrecision(3)));
}
