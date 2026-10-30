import type { ReactNode } from 'react';
import { ReadoutCell, ReadoutGrid } from '../readout-grid';
import { SignalMark, type SignalMarkKind } from '../signal-mark';
import { ScaleBar } from './scale-bar';

export interface ReadoutCardCell {
  label: string;
  /** Empty renders an em dash. */
  value?: ReactNode;
  unit?: string;
}

export interface ReadoutCardProps {
  title: string;
  place: string;
  /** Short source name on the header's right, e.g. `EU-DEM`. */
  sourceLabel: string;
  signalKind: SignalMarkKind;
  cells: readonly ReadoutCardCell[];
  scaleBar?: { totalKm: number; lengthPx: number };
  /** Full data credit, wrapped under the grid; required by real-terrain sources. */
  attribution?: string;
  /** Region name and header label. */
  label?: string;
  /** Removes the region from layout and the accessibility tree (short or phone viewports). */
  isHidden?: boolean;
}

/**
 * "Target lock" glass card (C-07): signal + label and source, title over place, a readout grid,
 * an optional scale bar and the data credit. 300px wide; a UI surface, so it takes the pointer.
 */
export function ReadoutCard({
  title,
  place,
  sourceLabel,
  signalKind,
  cells,
  scaleBar,
  attribution,
  label = 'Target lock',
  isHidden = false,
}: ReadoutCardProps): React.JSX.Element {
  return (
    <section
      className="lc-readout-card lc-glass"
      aria-label={label}
      data-ui-surface
      hidden={isHidden}
    >
      <div className="lc-readout-card__header">
        <span className="lc-readout-card__label">
          <SignalMark kind={signalKind} />
          {label}
        </span>
        <span className="lc-readout-card__source" title={sourceLabel}>
          {sourceLabel}
        </span>
      </div>
      <div className="lc-readout-card__identity">
        <p className="lc-readout-card__title">{title}</p>
        <p className="lc-readout-card__place">{place}</p>
      </div>
      <ReadoutGrid>
        {cells.map((cell) => (
          <ReadoutCell key={cell.label} label={cell.label} value={cell.value} unit={cell.unit} />
        ))}
      </ReadoutGrid>
      {scaleBar !== undefined && (
        <div className="lc-readout-card__scale">
          <ScaleBar totalKm={scaleBar.totalKm} lengthPx={scaleBar.lengthPx} />
        </div>
      )}
      {attribution !== undefined && <p className="lc-readout-card__attribution">{attribution}</p>}
    </section>
  );
}
