import type { ReactNode } from 'react';
import { Button } from './button';
import { Tag } from './tag';

export interface SuccessRow {
  /** Decorative; the label is the accessible name. */
  glyph: ReactNode;
  label: string;
  detail?: string;
  onClick: () => void;
  isDisabled?: boolean;
  /** Small outline tag after the label, such as "Soon". */
  tag?: string;
}

export interface SuccessSheetProps {
  title: string;
  rows: readonly SuccessRow[];
  onDone: () => void;
}

/** Hand-off after a finished export (C-20): a check tile, the title, then one row per next step. */
export function SuccessSheet({ title, rows, onDone }: SuccessSheetProps): React.JSX.Element {
  return (
    <section className="lc-success-sheet" role="status" aria-label={title}>
      <div className="lc-success-sheet__heading">
        <span className="lc-success-sheet__tile" aria-hidden="true">
          ✓
        </span>
        <h3 className="lc-success-sheet__title">{title}</h3>
      </div>
      <ul className="lc-success-sheet__rows">
        {rows.map((row) => (
          <li key={row.label}>
            <button
              className="lc-success-sheet__row"
              type="button"
              disabled={row.isDisabled}
              onClick={row.onClick}
            >
              <span className="lc-success-sheet__glyph" aria-hidden="true">
                {row.glyph}
              </span>
              <span className="lc-success-sheet__text">
                <span className="lc-success-sheet__label">{row.label}</span>
                {row.detail !== undefined && (
                  <span className="lc-success-sheet__detail">{row.detail}</span>
                )}
              </span>
              {row.tag !== undefined && <Tag variant="outlineMuted">{row.tag}</Tag>}
            </button>
          </li>
        ))}
      </ul>
      <Button variant="secondary" isFullWidth onClick={onDone}>
        Done
      </Button>
    </section>
  );
}
