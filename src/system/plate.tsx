import type { ReactNode } from 'react';
import { GlassPanel } from '../ui/glass-panel';

export interface PlateProps {
  label: string;
  note?: string;
  /** Content width in CSS pixels; plates otherwise size to their content. */
  contentWidthPx?: number;
  /** Takes the stage's full width, e.g. a type scale. */
  isFullWidth?: boolean;
  /** No body padding, for plates that draw edge to edge (overlays on a stage). */
  isFlush?: boolean;
  /** `hover`, `focus` or `active`: forces that state through the components' `[data-force-state]` rules. */
  forcedState?: string;
  children: ReactNode;
}

/** One specimen on the stage: a glass card with the live thing above a caption strip. */
export function Plate({
  label,
  note,
  contentWidthPx,
  isFullWidth = false,
  isFlush = false,
  forcedState,
  children,
}: PlateProps): React.JSX.Element {
  return (
    <GlassPanel
      padding="none"
      className="system-plate"
      dataAttributes={{
        'data-full-width': isFullWidth ? 'true' : undefined,
        'data-flush': isFlush ? 'true' : undefined,
      }}
    >
      <div className="system-plate__body" data-force-state={forcedState}>
        <div
          className="system-plate__content"
          style={contentWidthPx === undefined ? undefined : { width: contentWidthPx }}
        >
          {children}
        </div>
      </div>
      <div className="system-plate__caption">
        <span className="system-plate__label">{label}</span>
        {note !== undefined && note !== '' && <span className="system-plate__note">{note}</span>}
      </div>
    </GlassPanel>
  );
}
