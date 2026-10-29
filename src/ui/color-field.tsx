import { useId } from 'react';

export interface ColorFieldProps {
  label: string;
  /** A `#rrggbb` value, as `<input type="color">` requires. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
}

/** Colour row (P-11): label, hex readout and a swatch wrapping the native colour input. */
export function ColorField({
  label,
  value,
  onChange,
  disabled = false,
  id,
}: ColorFieldProps): React.JSX.Element {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <div className="lc-color-field">
      <label className="lc-color-field__label" htmlFor={fieldId}>
        {label}
      </label>
      <span className="lc-color-field__hex" aria-hidden="true">
        {value.toUpperCase()}
      </span>
      <span className="lc-color-field__swatch" style={{ backgroundColor: value }}>
        <input
          className="lc-color-field__input"
          id={fieldId}
          type="color"
          value={value}
          disabled={disabled}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      </span>
    </div>
  );
}
