import type { CSSProperties } from 'react';

export interface CompassProps {
  /** Bearing the view faces, 0 = north up. The rose turns the other way so N points north. */
  headingDegrees: number;
}

/** North arrow that turns with the 3D camera; static at 0 in the 2D plan view (O-07). */
export function Compass({ headingDegrees }: CompassProps): React.JSX.Element {
  const heading = Math.round(headingDegrees) % 360;

  return (
    <div
      className="lc-compass"
      role="img"
      aria-label={`North arrow, view heading ${heading}°`}
      data-azimuth={heading}
      style={{ '--lc-compass-rotation': `${-heading}deg` } as CSSProperties}
    >
      <span className="lc-compass__rose" aria-hidden="true">
        <span className="lc-compass__needle" />
        <span className="lc-compass__north">N</span>
      </span>
    </div>
  );
}
