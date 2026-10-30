/*
 * Command palette values, per row kind: the formatted current value, typed quick values, and an
 * `apply` that parses a typed value and hands it to the row's own callback, so the palette edits
 * exactly as the control does. Rows without a value (hints, buttons, custom) describe nothing.
 */
import { operationErrorCodes } from '../constants/operations';
import type { CommandQuickValue } from '../ui/command-palette';
import type { ControlRow, NumberRow, RangeRow, ToggleRow } from '../ui/control-rows';
import type { SelectItem, SelectOption } from '../ui/select';
import type { Result } from '../types/operations';

export type ValueRowKind =
  'toggle' | 'range' | 'select' | 'segmented' | 'number' | 'colour' | 'tiles';

export interface ValueControl {
  /** The control's DOM id: the row id, or a pair field's input id. */
  id: string;
  label: string;
  rowKind: ValueRowKind;
  /** Formatted as the control shows it, e.g. "0.4" or "1.2 px". */
  current: string;
  quickValues: readonly CommandQuickValue[];
  /** Parses `value` and calls the row's `onChange`; rejects text the control could not take. */
  apply: (value: string) => Result<void>;
}

// === PUBLIC API ===

/** The value-bearing controls in `row`: one for most kinds, two for a numeric pair, none for the rest. */
export function describeValueControls(row: ControlRow): ValueControl[] {
  switch (row.kind) {
    case 'toggle':
      return [describeToggle(row)];
    case 'range':
      return [describeRange(row)];
    case 'number':
      return [describeNumber(row.id, row)];
    case 'pair':
      return row.fields.flatMap((field) =>
        field.kind === 'number' ? [describeNumber(field.id, field)] : [],
      );
    case 'colour':
      return [
        guardDisabled(row.disabled, {
          id: row.id,
          label: row.label,
          rowKind: 'colour',
          current: row.value,
          quickValues: [],
          apply: (value) => {
            const hex = /^#?([0-9a-f]{6})$/i.exec(value.trim())?.[1];

            if (hex === undefined) {
              return rejectValue(`${row.label} takes a #rrggbb colour; got "${value}".`);
            }

            row.onChange(`#${hex.toLowerCase()}`);

            return accepted;
          },
        }),
      ];
    case 'select':
      return [describeChoice(row, 'select', row.options.flatMap(listSelectItems))];
    case 'segmented':
      return [describeChoice(row, 'segmented', row.options)];
    case 'tiles':
      return [describeChoice(row, 'tiles', row.options)];
    case 'hint':
    case 'status':
    case 'link':
    case 'button':
    case 'buttons':
    case 'custom':
      return [];
  }
}

/** `Number(value.toFixed(2))` plus the unit, as `designRangeRow` outputs read. */
export function formatRangeValue(value: number, unit = ''): string {
  return `${String(Number(value.toFixed(2)))}${unit}`;
}

// === ROW KINDS ===

const accepted: Result<void> = { ok: true, data: undefined };

function describeToggle(row: ToggleRow): ValueControl {
  return guardDisabled(row.disabled, {
    id: row.id,
    label: row.label,
    rowKind: 'toggle',
    current: row.value ? 'On' : 'Off',
    quickValues: [
      { label: 'On', value: 'on' },
      { label: 'Off', value: 'off' },
    ],
    apply: (value) => {
      const normalized = value.trim().toLowerCase();

      if (!toggleWords.on.includes(normalized) && !toggleWords.off.includes(normalized)) {
        return rejectValue(`${row.label} takes on or off; got "${value}".`);
      }

      row.onChange(toggleWords.on.includes(normalized));

      return accepted;
    },
  });
}

/**
 * Quick values: min, middle, max and the current value ± ten steps. Stop sliders that show a
 * `displayValue` (the area span) offer none, since their numbers are stop indexes.
 */
function describeRange(row: RangeRow): ValueControl {
  const { min, max, step, value, unit } = row;
  const snap = (candidate: number) => snapToStep(candidate, min, max, step);
  const quickNumbers =
    row.displayValue === undefined
      ? [min, (min + max) / 2, max, value - step * 10, value + step * 10].map(snap)
      : [];

  return guardDisabled(row.disabled, {
    id: row.id,
    label: row.label,
    rowKind: 'range',
    current: row.displayValue ?? formatRangeValue(value, unit),
    quickValues: [...new Set(quickNumbers)]
      .sort((a, b) => a - b)
      .map((quick) => ({ label: formatRangeValue(quick, unit), value: String(quick) })),
    apply: (typed) => {
      const parsed = Number.parseFloat(typed);

      if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
        return rejectValue(`${row.label} takes ${String(min)} to ${String(max)}; got "${typed}".`);
      }

      row.onChange(snap(parsed));

      return accepted;
    },
  });
}

function describeNumber(id: string, row: Omit<NumberRow, 'kind' | 'id'>): ValueControl {
  const { min = -Infinity, max = Infinity, isOptional = false, unit } = row;

  return guardDisabled(row.disabled, {
    id,
    label: row.label,
    rowKind: 'number',
    current:
      row.value === undefined
        ? 'None'
        : `${String(row.value)}${unit === undefined ? '' : ` ${unit}`}`,
    quickValues: [],
    apply: (typed) => {
      if (typed.trim() === '' && isOptional) {
        return row.onChange(undefined) === false
          ? rejectValue(`${row.label} cannot be cleared right now.`)
          : accepted;
      }

      const parsed = Number.parseFloat(typed);

      if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
        return rejectValue(`${row.label} takes ${String(min)} to ${String(max)}; got "${typed}".`);
      }

      return row.onChange(parsed) === false
        ? rejectValue(`${row.label} rejected ${String(parsed)}.`)
        : accepted;
    },
  });
}

/** Select, segmented and tiles: a typed value matches an option's value or label, ignoring case. */
function describeChoice(
  row: {
    id: string;
    label: string;
    value: string;
    disabled?: boolean;
    onChange: (value: string) => void;
  },
  rowKind: 'select' | 'segmented' | 'tiles',
  options: readonly SelectItem<string>[],
): ValueControl {
  return guardDisabled(row.disabled, {
    id: row.id,
    label: row.label,
    rowKind,
    current: options.find((option) => option.value === row.value)?.label ?? row.value,
    quickValues: options.map(({ label, value }) => ({ label, value })),
    apply: (typed) => {
      const needle = typed.trim().toLowerCase();
      const match = options.find(
        ({ value, label }) => value.toLowerCase() === needle || label.toLowerCase() === needle,
      );

      if (match === undefined) {
        return rejectValue(
          `${row.label} takes one of ${options.map(({ label }) => label).join(', ')}; got "${typed}".`,
        );
      }

      row.onChange(match.value);

      return accepted;
    },
  });
}

// === HELPERS ===

const toggleWords = { on: ['on', 'true', 'yes', '1'], off: ['off', 'false', 'no', '0'] };

/** A disabled control stays listed, so its id is findable, but refuses every value. */
function guardDisabled(isDisabled: boolean | undefined, control: ValueControl): ValueControl {
  if (isDisabled !== true) {
    return control;
  }

  return {
    ...control,
    apply: () => rejectValue(`${control.label} is unavailable in the current setup.`),
  };
}

function rejectValue(message: string): Result<void> {
  return {
    ok: false,
    error: { code: operationErrorCodes.invalidSettings, message, retryable: false },
  };
}

function listSelectItems(option: SelectOption<string>): SelectItem<string>[] {
  if (typeof option === 'string') {
    return [{ value: option, label: option }];
  }

  return 'group' in option ? [...option.options] : [option];
}

/** Clamps to the slider's bounds and rounds to its step, trimming float noise to the step's decimals. */
function snapToStep(value: number, min: number, max: number, step: number): number {
  const clamped = Math.min(max, Math.max(min, value));
  const decimals = String(step).split('.')[1]?.length ?? 0;

  const snapped = min + Math.round((clamped - min) / step) * step;

  return Number(Math.min(max, snapped).toFixed(decimals));
}
