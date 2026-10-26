import { useEffect, useId, useState, type ReactNode } from 'react';

export function Group({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <fieldset className="studio-group">
      <legend>{title}</legend>
      {children}
    </fieldset>
  );
}

export function Hint({ children }: { children: ReactNode }): ReactNode {
  return <p className="export-hint">{children}</p>;
}

export function Toggle({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}): ReactNode {
  return (
    <label className="toggle-row">
      {label}
      <input
        type="checkbox"
        role="switch"
        checked={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
    </label>
  );
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  id,
}: {
  label: string;
  value: T;
  options: readonly (T | { value: T; label: string })[];
  onChange: (value: T) => void;
  disabled?: boolean;
  id?: string;
}): ReactNode {
  const generatedId = useId();

  return (
    <div className="field-row">
      <label htmlFor={id ?? generatedId}>{label}</label>
      <select
        id={id ?? generatedId}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value as T);
        }}
      >
        {options.map((option) => {
          const item = typeof option === 'string' ? { value: option, label: option } : option;

          return (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          );
        })}
      </select>
    </div>
  );
}

/** A few mutually exclusive options shown side by side, styled like the view switch. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}): ReactNode {
  return (
    <div className="segmented-row">
      <span>{label}</span>
      <div role="group" aria-label={label} className="segmented-control">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            onClick={() => {
              onChange(option.value);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Color({
  label,
  value,
  onChange,
  disabled = false,
  id,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
}): ReactNode {
  return (
    <label className="field-row">
      <span>{label}</span>
      <input
        id={id}
        type="color"
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </label>
  );
}

/** Keep incomplete edits local; commit validated numbers on blur/Enter rather than each keystroke. */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 'any',
  optional = false,
  id,
  disabled = false,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => unknown;
  min?: number;
  max?: number;
  step?: number | 'any';
  optional?: boolean;
  id?: string;
  disabled?: boolean;
}): ReactNode {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const [draft, setDraft] = useState(value === undefined ? '' : String(value));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setDraft(value === undefined ? '' : String(value));
    setInvalid(false);
  }, [value]);

  const commit = () => {
    const number = draft === '' && optional ? undefined : Number(draft);
    const valid =
      (optional && number === undefined) ||
      (draft !== '' &&
        number !== undefined &&
        Number.isFinite(number) &&
        (min === undefined || number >= min) &&
        (max === undefined || number <= max));

    setInvalid(!valid || onChange(number) === false);
  };

  return (
    <div className="number-field">
      <label htmlFor={fieldId}>{label}</label>
      <input
        id={fieldId}
        type="number"
        value={draft}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={(event) => {
          setDraft(event.target.value);
          setInvalid(false);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
        }}
      />
      {invalid && (
        <small role="alert">
          Enter a valid value{min === undefined ? '' : ` from ${min}`}
          {max === undefined ? '' : ` to ${max}`}.
        </small>
      )}
    </div>
  );
}

export function Range({
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix = '',
  displayValue,
  id,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  /** Shown and announced instead of `value`, for sliders that step through a list of stops. */
  displayValue?: string;
  id?: string;
  disabled?: boolean;
}): ReactNode {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <div className="range-control">
      <label htmlFor={fieldId}>{label}</label>
      <output htmlFor={fieldId}>{displayValue ?? `${Number(value.toFixed(2))}${suffix}`}</output>
      <input
        id={fieldId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={displayValue}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.valueAsNumber);
        }}
      />
    </div>
  );
}

export function Button({
  children,
  onClick,
  disabled = false,
  primary = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}): ReactNode {
  return (
    <button
      type="button"
      className={primary ? 'primary-button' : 'text-button'}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function namedOptions(
  values: Record<string, { label: string }>,
): { value: string; label: string }[] {
  return Object.entries(values).map(([value, { label }]) => ({ value, label }));
}
