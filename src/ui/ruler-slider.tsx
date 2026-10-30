import { useId, type CSSProperties } from 'react';

export interface RulerSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  /** Appended verbatim to the number, so include any leading space (" s"). */
  unit?: string;
  /** Shown and announced instead of `value`, for sliders that step through a list of stops. */
  displayValue?: string;
  id?: string;
  disabled?: boolean;
  tickCount?: number;
}

/** Ruler-style range control (P-07). The `<output>` text is a binding e2e contract. */
export function RulerSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  unit,
  displayValue,
  id,
  disabled = false,
  tickCount = 10,
}: RulerSliderProps): React.JSX.Element {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const style = { '--lc-slider-fraction': rulerSliderFraction(value, min, max) } as CSSProperties;

  return (
    <div className="lc-ruler-slider" style={style}>
      <div className="lc-ruler-slider__head">
        <label className="lc-ruler-slider__label" htmlFor={fieldId}>
          {label}
        </label>
        <output className="lc-ruler-slider__value" htmlFor={fieldId}>
          {displayValue ?? (
            <>
              {Number(value.toFixed(2))}
              {unit !== undefined && unit !== '' && (
                <span className="lc-ruler-slider__unit">{unit}</span>
              )}
            </>
          )}
        </output>
      </div>
      <div className="lc-ruler-slider__track">
        <span className="lc-ruler-slider__rail" aria-hidden="true" />
        <span className="lc-ruler-slider__ticks" aria-hidden="true">
          {Array.from({ length: Math.max(0, tickCount) }, (_, index) => (
            <span key={index} className="lc-ruler-slider__tick" />
          ))}
        </span>
        <span className="lc-ruler-slider__fill" aria-hidden="true" />
        <span className="lc-ruler-slider__thumb" aria-hidden="true" />
        <input
          className="lc-ruler-slider__input"
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
    </div>
  );
}

/** Position of `value` in [min, max], clamped to [0, 1]; a degenerate or non-finite range gives 0. */
export function rulerSliderFraction(value: number, min: number, max: number): number {
  const fraction = (value - min) / (max - min);

  if (max === min || !Number.isFinite(fraction)) {
    return 0;
  }

  return Math.min(1, Math.max(0, fraction));
}
