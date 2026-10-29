import type { ReactNode } from 'react';

export type SearchFieldSize = 'bar' | 'mobile';

/** The caller puts this class on its `<input role="combobox">` so the frame can style it. */
export const searchFieldInputClassName = 'lc-search-field__input';

export interface SearchFieldProps {
  /** Accessible name of the field (the frame wraps the input, so this labels it). */
  label: string;
  /** The caller's `<input role="combobox">`; all combobox behaviour stays with the caller. */
  input: ReactNode;
  /** The caller's results listbox, rendered below the frame. */
  popover: ReactNode;
  isOpen: boolean;
  prefixLabel?: string;
  keyboardHint?: string[];
  size?: SearchFieldSize;
  className?: string;
  /** Attribution line below the frame; the caller gives it `role="status"`. */
  statusLine?: ReactNode;
}

/** Presentational frame for a location search (P-10). Shrinks first in a bar. */
export function SearchField({
  label,
  input,
  popover,
  isOpen,
  prefixLabel = 'LOC',
  keyboardHint,
  size = 'bar',
  className,
  statusLine,
}: SearchFieldProps): React.JSX.Element {
  return (
    <div
      className={className === undefined ? 'lc-search-field' : `lc-search-field ${className}`}
      data-size={size}
      data-open={isOpen}
    >
      <label className="lc-search-field__frame" data-ui-surface>
        <span className="lc-search-field__label">{label}</span>
        <span className="lc-search-field__prefix" aria-hidden="true">
          {prefixLabel}
        </span>
        {input}
        {keyboardHint !== undefined && keyboardHint.length > 0 && (
          <span className="lc-search-field__hint" aria-hidden="true">
            {keyboardHint.map((key) => (
              <kbd key={key} className="lc-search-field__key">
                {key}
              </kbd>
            ))}
          </span>
        )}
      </label>
      <div className="lc-search-field__popover">{popover}</div>
      {statusLine !== undefined && <div className="lc-search-field__status">{statusLine}</div>}
    </div>
  );
}
