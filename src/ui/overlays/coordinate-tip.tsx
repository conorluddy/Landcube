export interface CoordinateTipProps {
  /** One Mono line each, e.g. latitude then longitude; an empty list renders an em dash. */
  lines: readonly string[];
}

/** Small glass box beside the crosshair with the place under the pointer (O-03). */
export function CoordinateTip({ lines }: CoordinateTipProps): React.JSX.Element {
  return (
    <div className="lc-coordinate-tip">
      {lines.length === 0 ? <span>—</span> : lines.map((line) => <span key={line}>{line}</span>)}
    </div>
  );
}
