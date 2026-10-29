import { useId } from 'react';

export interface CheckboxProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  /** Right-aligned secondary text, such as a file size. */
  detail?: string;
  id?: string;
}

/** 18x18 drawn checkbox (P-14) over an invisible native checkbox that keeps the hit target. */
export function Checkbox({
  label,
  value,
  onChange,
  disabled = false,
  detail,
  id,
}: CheckboxProps): React.JSX.Element {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <label className="lc-checkbox" htmlFor={inputId}>
      <input
        className="lc-checkbox__input"
        id={inputId}
        type="checkbox"
        checked={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
      <span className="lc-checkbox__box" aria-hidden="true" />
      <span className="lc-checkbox__text">{label}</span>
      {detail !== undefined && <span className="lc-checkbox__detail">{detail}</span>}
    </label>
  );
}
