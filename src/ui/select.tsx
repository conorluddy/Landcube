/*
 * Select (P-08). The design draws a click-to-cycle control; that is deliberately not implemented
 * (open question in #86). A real native <select> is kept for the location menu, #terrain-place,
 * mobile pickers and Playwright's selectOption(). Only the frame around it is drawn.
 */
import { useId } from 'react';

export interface SelectItem<T extends string> {
  value: T;
  label: string;
}

export interface SelectGroup<T extends string> {
  group: string;
  options: readonly SelectItem<T>[];
}

export type SelectOption<T extends string> = T | SelectItem<T> | SelectGroup<T>;

export interface SelectProps<T extends string> {
  label: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  id?: string;
  /** Defaults to true when the options are ungrouped and number 12 or fewer. */
  isPositionShown?: boolean;
}

const maximumDefaultPositionCount = 12;

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  id,
  isPositionShown,
}: SelectProps<T>): React.JSX.Element {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const items = options.flatMap(flattenOption);
  const selectedIndex = items.findIndex((item) => item.value === value);
  const hasGroups = options.some(isGroup);
  const shouldShowPosition =
    (isPositionShown ?? (!hasGroups && items.length <= maximumDefaultPositionCount)) &&
    selectedIndex >= 0;

  return (
    <div className="lc-select-row">
      <label className="lc-select-row__label" htmlFor={selectId}>
        {label}
      </label>
      <div className="lc-select" data-has-position={shouldShowPosition}>
        <select
          className="lc-select__control"
          id={selectId}
          value={value}
          disabled={disabled}
          onChange={(event) => {
            onChange(event.target.value as T);
          }}
        >
          {options.map(renderOption)}
        </select>
        {shouldShowPosition && (
          <span className="lc-select__position" aria-hidden="true">
            {formatPosition(selectedIndex, items.length)}
          </span>
        )}
      </div>
    </div>
  );
}

function isGroup<T extends string>(option: SelectOption<T>): option is SelectGroup<T> {
  return typeof option === 'object' && 'group' in option;
}

function toItem<T extends string>(option: T | SelectItem<T>): SelectItem<T> {
  return typeof option === 'string' ? { value: option, label: option } : option;
}

function flattenOption<T extends string>(option: SelectOption<T>): SelectItem<T>[] {
  return isGroup(option) ? [...option.options] : [toItem(option)];
}

function renderOption<T extends string>(option: SelectOption<T>): React.JSX.Element {
  if (isGroup(option)) {
    return (
      <optgroup key={option.group} label={option.group}>
        {option.options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </optgroup>
    );
  }

  const item = toItem(option);

  return (
    <option key={item.value} value={item.value}>
      {item.label}
    </option>
  );
}

function formatPosition(selectedIndex: number, total: number): string {
  const pad = (number: number): string => String(number).padStart(2, '0');

  return `${pad(selectedIndex + 1)}/${pad(total)}`;
}
