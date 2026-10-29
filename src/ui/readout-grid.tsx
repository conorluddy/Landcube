import type { ReactNode } from 'react';

export interface ReadoutGridProps {
  children: ReactNode;
}

export interface ReadoutCellProps {
  label: string;
  /** Empty, null or undefined renders an em dash. */
  value?: ReactNode;
  unit?: string;
  isTabular?: boolean;
}

/** Two-column definition list with hairline rows (P-20). */
export function ReadoutGrid({ children }: ReadoutGridProps): React.JSX.Element {
  return <dl className="lc-readout-grid">{children}</dl>;
}

/** One label/value pair inside a ReadoutGrid. */
export function ReadoutCell({
  label,
  value,
  unit,
  isTabular = true,
}: ReadoutCellProps): React.JSX.Element {
  const hasValue = value !== undefined && value !== null && value !== '' && value !== false;

  return (
    <div className="lc-readout-cell">
      <dt className="lc-readout-cell__label">{label}</dt>
      <dd className="lc-readout-cell__value" data-tabular={isTabular ? 'true' : undefined}>
        {hasValue ? value : '—'}
        {hasValue && unit !== undefined ? (
          <>
            {' '}
            <span className="lc-readout-cell__unit">{unit}</span>
          </>
        ) : null}
      </dd>
    </div>
  );
}
