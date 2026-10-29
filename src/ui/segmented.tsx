import { useId, useRef } from 'react';

export type SegmentedSize = 'compact' | 'medium' | 'bar' | 'large';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Shown as the native tooltip; the visible label stays the accessible name. */
  description?: string;
}

export interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  /** Two to four entries; anything else is a programming error and throws. */
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  size?: SegmentedSize;
  /** False moves the label to `aria-label` on the group. */
  isLabelVisible?: boolean;
  isOnGlassBar?: boolean;
  disabled?: boolean;
}

const minimumOptionCount = 2;
const maximumOptionCount = 4;

/** A few mutually exclusive options side by side (P-05). Arrow keys move selection and focus. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = 'medium',
  isLabelVisible = true,
  isOnGlassBar = false,
  disabled = false,
}: SegmentedProps<T>): React.JSX.Element {
  assertOptionCount(label, options.length);

  const labelId = useId();
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const tabStopIndex = Math.max(selectedIndex, 0);

  const moveSelection = (event: React.KeyboardEvent, direction: 1 | -1): void => {
    event.preventDefault();
    const nextIndex = (tabStopIndex + direction + options.length) % options.length;

    onChange(options[nextIndex].value);
    buttonRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="lc-segmented-row">
      {isLabelVisible && (
        <span className="lc-segmented-row__label" id={labelId}>
          {label}
        </span>
      )}
      <div
        className="lc-segmented"
        role="group"
        aria-labelledby={isLabelVisible ? labelId : undefined}
        aria-label={isLabelVisible ? undefined : label}
        data-size={size}
        data-on-glass-bar={isOnGlassBar || undefined}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') {
            moveSelection(event, 1);
          } else if (event.key === 'ArrowLeft') {
            moveSelection(event, -1);
          }
        }}
      >
        {options.map((option, index) => (
          <button
            key={option.value}
            ref={(element) => {
              buttonRefs.current[index] = element;
            }}
            className="lc-segmented__item"
            type="button"
            aria-pressed={option.value === value}
            tabIndex={index === tabStopIndex ? 0 : -1}
            title={option.description}
            disabled={disabled}
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

function assertOptionCount(label: string, optionCount: number): void {
  if (optionCount < minimumOptionCount || optionCount > maximumOptionCount) {
    throw new Error(
      `Segmented "${label}" needs ${String(minimumOptionCount)} to ${String(maximumOptionCount)} options, got ${String(optionCount)}. Use Select or ChoiceTiles for other counts.`,
    );
  }
}
