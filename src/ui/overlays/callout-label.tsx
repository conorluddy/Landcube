import type { CSSProperties } from 'react';

export interface CalloutLabelProps {
  /** The point the leader runs down to, relative to the overlay. */
  anchor: { xPx: number; yPx: number };
  /** The headline value, e.g. `3.75 km`. */
  value: string;
  /** Mono meta under the value, e.g. `Bearing 090°`; empty strings are skipped. */
  meta?: readonly string[];
}

/**
 * Small HUD label on a 20px leader above a point on the canvas (O-06). Tip glass like the
 * CoordinateTip; never takes the pointer and is not a UI surface.
 */
export function CalloutLabel({ anchor, value, meta = [] }: CalloutLabelProps): React.JSX.Element {
  const style = {
    '--lc-callout-x': `${String(Math.round(anchor.xPx))}px`,
    '--lc-callout-y': `${String(Math.round(anchor.yPx))}px`,
  } as CSSProperties;

  return (
    <div className="lc-callout-label" style={style}>
      <span className="lc-callout-label__leader" aria-hidden="true" />
      <div className="lc-callout-label__box">
        <span className="lc-callout-label__value">{value}</span>
        {meta
          .filter((line) => line !== '')
          .map((line) => (
            <span key={line} className="lc-callout-label__meta">
              {line}
            </span>
          ))}
      </div>
    </div>
  );
}
