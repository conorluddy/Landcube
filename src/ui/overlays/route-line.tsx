import { SignalMark } from '../signal-mark';

export interface RouteLinePoint {
  x: number;
  y: number;
}

export interface RouteLineProps {
  /** The overlay's own size in px; points are in the same space. */
  widthPx: number;
  heightPx: number;
  points: readonly RouteLinePoint[];
  waypoints: readonly (RouteLinePoint & { name: string })[];
  /** Names the route for assistive tech, e.g. "Route: Ridge walk". */
  label: string;
}

/**
 * GPX route over the 2D terrain (O-08): a 2.5px bone line over a 7px ink halo at 0.5, with
 * diamond waypoints and a label tip. Never takes the pointer. `data-route-points` and
 * `data-route-waypoints` are the test hooks.
 */
export function RouteLine({
  widthPx,
  heightPx,
  points,
  waypoints,
  label,
}: RouteLineProps): React.JSX.Element {
  const polyline = points.map(({ x, y }) => `${round(x)},${round(y)}`).join(' ');

  return (
    <div
      className="lc-route-line"
      role="img"
      aria-label={label}
      data-route-points={points.length}
      data-route-waypoints={waypoints.length}
    >
      <svg
        className="lc-route-line__path"
        viewBox={`0 0 ${widthPx} ${heightPx}`}
        width={widthPx}
        height={heightPx}
        aria-hidden="true"
        focusable="false"
      >
        <polyline className="lc-route-line__halo" points={polyline} />
        <polyline className="lc-route-line__line" points={polyline} />
      </svg>
      {waypoints.map(({ x, y, name }, index) => (
        <div
          key={`${index}-${name}`}
          className="lc-route-line__waypoint"
          style={{ left: `${round(x)}px`, top: `${round(y)}px` }}
        >
          <SignalMark kind="waypoint" />
          <span className="lc-route-line__label">{name}</span>
        </div>
      ))}
    </div>
  );
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
