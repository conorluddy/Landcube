import { useRef, useState, type CSSProperties, type ReactNode } from 'react';

export type ChoiceTileColumns = 3 | 5 | 6;

export interface ChoiceTileOption<T extends string> {
  value: T;
  label: string;
  swatchColor?: string;
  swatchBorderColor?: string;
  thumbnail?: ReactNode;
  /** Shown as the native tooltip; the visible label stays the accessible name. */
  description?: string;
}

export interface ChoiceTilesProps<T extends string> {
  label: string;
  value: T;
  options: readonly ChoiceTileOption<T>[];
  onChange: (value: T) => void;
  columns?: ChoiceTileColumns;
  disabled?: boolean;
  /** Overrides `value` equality, for presets whose pressed state spans several settings. */
  isPressedComputed?: (option: ChoiceTileOption<T>) => boolean;
}

/** Grid of single-choice tiles (P-12). Arrow keys move focus; Space or Enter chooses. */
export function ChoiceTiles<T extends string>({
  label,
  value,
  options,
  onChange,
  columns = 3,
  disabled = false,
  isPressedComputed,
}: ChoiceTilesProps<T>): React.JSX.Element {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const isPressed = (option: ChoiceTileOption<T>): boolean =>
    isPressedComputed ? isPressedComputed(option) : option.value === value;
  const tabStopIndex = focusedIndex ?? Math.max(options.findIndex(isPressed), 0);

  const moveFocus = (event: React.KeyboardEvent): void => {
    const nextIndex = findNextIndex(event.key, tabStopIndex, options.length, columns);

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    buttonRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      className="lc-choice-tiles"
      role="group"
      aria-label={label}
      data-columns={columns}
      onKeyDown={moveFocus}
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(element) => {
            buttonRefs.current[index] = element;
          }}
          className="lc-choice-tiles__tile"
          type="button"
          aria-pressed={isPressed(option)}
          tabIndex={index === tabStopIndex ? 0 : -1}
          title={option.description ?? option.label}
          disabled={disabled}
          onFocus={() => {
            setFocusedIndex(index);
          }}
          onClick={() => {
            onChange(option.value);
          }}
        >
          {option.thumbnail !== undefined && (
            <span className="lc-choice-tiles__thumbnail" aria-hidden="true">
              {option.thumbnail}
            </span>
          )}
          {option.swatchColor !== undefined && (
            <span
              className="lc-choice-tiles__swatch"
              aria-hidden="true"
              style={swatchStyle(option)}
            />
          )}
          <span className="lc-choice-tiles__label">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

function swatchStyle<T extends string>(option: ChoiceTileOption<T>): CSSProperties {
  return {
    '--lc-tile-swatch': option.swatchColor,
    '--lc-tile-swatch-border': option.swatchBorderColor,
  } as CSSProperties;
}

/** Grid navigation: left/right step by one, up/down by a row, Home/End jump to the ends. */
function findNextIndex(
  key: string,
  currentIndex: number,
  count: number,
  columns: number,
): number | null {
  const lastIndex = count - 1;

  switch (key) {
    case 'ArrowRight':
      return Math.min(currentIndex + 1, lastIndex);
    case 'ArrowLeft':
      return Math.max(currentIndex - 1, 0);
    case 'ArrowDown':
      return Math.min(currentIndex + columns, lastIndex);
    case 'ArrowUp':
      return Math.max(currentIndex - columns, 0);
    case 'Home':
      return 0;
    case 'End':
      return lastIndex;
    default:
      return null;
  }
}
