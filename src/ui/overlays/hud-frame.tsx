export interface HudFrameProps {
  /** Camera readouts along the top left, e.g. `['View 3D · Orbit', 'FOV 38°']`. */
  readouts: string[];
  /** Right-aligned readout, e.g. `Contour 20 m`. */
  trailingReadout?: string;
}

const corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;

/** Corner brackets, a top tick ruler and camera readouts around the open viewport (O-01). */
export function HudFrame({ readouts, trailingReadout }: HudFrameProps): React.JSX.Element {
  return (
    <div className="lc-hud-frame" aria-hidden="true">
      {corners.map((corner) => (
        <span key={corner} className="lc-hud-frame__corner" data-corner={corner} />
      ))}
      <span className="lc-hud-frame__ruler" />
      <div className="lc-hud-frame__readouts">
        {readouts.map((readout) => (
          <span key={readout}>{readout}</span>
        ))}
      </div>
      {trailingReadout !== undefined && (
        <span className="lc-hud-frame__trailing">{trailingReadout}</span>
      )}
    </div>
  );
}
