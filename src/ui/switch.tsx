import { useId } from 'react';

export interface SwitchProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  id?: string;
  /** Linked with `aria-describedby`, so it does not change the accessible name. */
  description?: string;
}

/** Two-cell OFF/ON switch (P-06) over an invisible native checkbox that keeps the hit target. */
export function Switch({
  label,
  value,
  onChange,
  disabled = false,
  id,
  description,
}: SwitchProps): React.JSX.Element {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = `${inputId}-description`;

  return (
    <div className="lc-switch">
      <label className="lc-switch__row" htmlFor={inputId}>
        <input
          className="lc-switch__input"
          id={inputId}
          type="checkbox"
          role="switch"
          checked={value}
          disabled={disabled}
          aria-describedby={description === undefined ? undefined : descriptionId}
          onChange={(event) => {
            onChange(event.target.checked);
          }}
        />
        <span className="lc-switch__text">{label}</span>
        <span className="lc-switch__track" aria-hidden="true">
          <span className="lc-switch__cell" data-cell="off">
            OFF
          </span>
          <span className="lc-switch__cell" data-cell="on">
            ON
          </span>
        </span>
      </label>
      {description !== undefined && (
        <small className="lc-switch__description" id={descriptionId}>
          {description}
        </small>
      )}
    </div>
  );
}
