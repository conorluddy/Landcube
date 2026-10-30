import type { CSSProperties, ReactNode } from 'react';

export interface CrosshairProps {
  /** Pointer position inside the overlay; absent hides the crosshair (pointer away or over UI). */
  position?: { xPx: number; yPx: number };
  /** Usually a CoordinateTip, placed 12px below and right of the pointer. */
  children?: ReactNode;
}

/**
 * Full-bleed hairlines through the pointer (O-02). Position travels as `--lc-crosshair-x/y` so
 * moves only restyle; `data-state` reads `tracking` or `hidden`. Never shown without hover.
 */
export function Crosshair({ position, children }: CrosshairProps): React.JSX.Element {
  const style =
    position === undefined
      ? undefined
      : ({
          '--lc-crosshair-x': `${position.xPx}px`,
          '--lc-crosshair-y': `${position.yPx}px`,
        } as CSSProperties);

  return (
    <div
      className="lc-crosshair"
      data-state={position === undefined ? 'hidden' : 'tracking'}
      style={style}
      aria-hidden="true"
    >
      <span className="lc-crosshair__line" data-axis="horizontal" />
      <span className="lc-crosshair__line" data-axis="vertical" />
      {children !== undefined && <div className="lc-crosshair__tip">{children}</div>}
    </div>
  );
}
