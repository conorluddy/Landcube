import type { ReactNode, Ref } from 'react';

export type HudCanvasTone = 'light' | 'dark';
export type HudInspectorState = 'expanded' | 'collapsed';

export interface HudLayerProps {
  /** Marks are dark ink over a light canvas and pale over a dark one. */
  canvasTone: HudCanvasTone;
  /** The frame stops short of the inspector, which is wide when expanded and a rail when collapsed. */
  inspectorState: HudInspectorState;
  /** Full-bleed pointer overlays such as the Crosshair. */
  pointer?: ReactNode;
  /** The HudFrame, laid out between the bars and beside the inspector. */
  frame?: ReactNode;
  /** Compass and scale bar, at the frame's bottom right (top right on phones). */
  instruments?: ReactNode;
  /** The ReadoutCard, bottom left above the footer. */
  readout?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Positions the canvas overlays over the studio viewport. Never takes the pointer itself; only a
 * glass ReadoutCard inside does. `data-hud` is the test and tool-overlay hook.
 */
export function HudLayer({
  canvasTone,
  inspectorState,
  pointer,
  frame,
  instruments,
  readout,
  ref,
}: HudLayerProps): React.JSX.Element {
  return (
    <div
      ref={ref}
      className="lc-hud-layer"
      data-hud
      data-canvas-tone={canvasTone}
      data-inspector={inspectorState}
    >
      {pointer}
      {frame !== undefined && <div className="lc-hud-layer__frame">{frame}</div>}
      {instruments !== undefined && <div className="lc-hud-layer__instruments">{instruments}</div>}
      {readout !== undefined && <div className="lc-hud-layer__readout">{readout}</div>}
    </div>
  );
}
