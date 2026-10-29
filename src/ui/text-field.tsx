import { useId } from 'react';

export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  isMonospace?: boolean;
  /** Validation message; sets `aria-invalid` and renders a `role="alert"` line. */
  error?: string;
}

/** Free-text field in the shared P-09 frame (manual link, plaque text). */
export function TextField({
  label,
  value,
  onChange,
  placeholder = '—',
  id,
  disabled = false,
  isMonospace = true,
  error,
}: TextFieldProps): React.JSX.Element {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;

  return (
    <div className="lc-field">
      <div className="lc-field__head">
        <label className="lc-field__label" htmlFor={fieldId}>
          {label}
        </label>
      </div>
      <input
        className="lc-field__input"
        id={fieldId}
        type="text"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        data-mono={isMonospace}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={error === undefined ? undefined : errorId}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      {error !== undefined && (
        <small className="lc-field__error" id={errorId} role="alert">
          {error}
        </small>
      )}
    </div>
  );
}
