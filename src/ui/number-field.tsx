import { useEffect, useId, useState } from 'react';

export interface NumberFieldProps {
  label: string;
  value: number | undefined;
  /** Return `false` to reject the value and show the error. */
  onChange: (value: number | undefined) => unknown;
  min?: number;
  max?: number;
  step?: number | 'any';
  isOptional?: boolean;
  /** Right-aligned in the label head, e.g. "px". */
  unit?: string;
  id?: string;
  disabled?: boolean;
}

export interface NumberDraftRules {
  min?: number;
  max?: number;
  isOptional: boolean;
}

export type NumberDraftResult = { isValid: true; value: number | undefined } | { isValid: false };

/** Keeps incomplete edits local; commits validated numbers on blur or Enter rather than per keystroke. */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 'any',
  isOptional = false,
  unit,
  id,
  disabled = false,
}: NumberFieldProps): React.JSX.Element {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;
  const [draft, setDraft] = useState(formatNumberDraft(value));
  const [isInvalid, setIsInvalid] = useState(false);

  useEffect(() => {
    setDraft(formatNumberDraft(value));
    setIsInvalid(false);
  }, [value]);

  const commit = (): void => {
    const result = parseNumberDraft(draft, { min, max, isOptional });

    setIsInvalid(!result.isValid || onChange(result.value) === false);
  };

  return (
    <div className="lc-field">
      <div className="lc-field__head">
        <label className="lc-field__label" htmlFor={fieldId}>
          {label}
        </label>
        {unit !== undefined && <span className="lc-field__unit">{unit}</span>}
      </div>
      <input
        className="lc-field__input"
        id={fieldId}
        type="number"
        value={draft}
        min={min}
        max={max}
        step={step}
        placeholder="—"
        disabled={disabled}
        aria-invalid={isInvalid || undefined}
        aria-describedby={isInvalid ? errorId : undefined}
        onChange={(event) => {
          setDraft(event.target.value);
          setIsInvalid(false);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
        }}
      />
      {isInvalid && (
        <small className="lc-field__error" id={errorId} role="alert">
          {describeNumberRange(min, max)}
        </small>
      )}
    </div>
  );
}

// === PURE LOGIC ===

export function formatNumberDraft(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}

/** Valid when optional and empty, or a finite number inside the optional bounds. */
export function parseNumberDraft(draft: string, rules: NumberDraftRules): NumberDraftResult {
  if (draft === '' && rules.isOptional) {
    return { isValid: true, value: undefined };
  }

  const number = Number(draft);
  const isValid =
    draft !== '' &&
    Number.isFinite(number) &&
    (rules.min === undefined || number >= rules.min) &&
    (rules.max === undefined || number <= rules.max);

  return isValid ? { isValid, value: number } : { isValid };
}

/** Same wording as the original studio field. */
export function describeNumberRange(min: number | undefined, max: number | undefined): string {
  return `Enter a valid value${min === undefined ? '' : ` from ${String(min)}`}${
    max === undefined ? '' : ` to ${String(max)}`
  }.`;
}
