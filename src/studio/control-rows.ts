/*
 * Typed row factories for the studio's control-group builders. Each keeps the option generic at
 * the call site and emits the erased `ControlRow` that `src/ui/` renders; option callbacks map the
 * erased string back to the typed option and throw if the value is not one of the options.
 */
import type { ReactNode } from 'react';
import { designNumberConstraints } from '../constants/design';
import type { ButtonProps } from '../ui/button';
import type { ChoiceTilesProps } from '../ui/choice-tiles';
import type { ColorFieldProps } from '../ui/color-field';
import type {
  ButtonRow,
  ColourRow,
  CustomRow,
  HintRow,
  NumberRow,
  RangeRow,
  SegmentedRow,
  SelectRow,
  StatusRow,
  TilesRow,
  ToggleRow,
  ToggleRowProps,
} from '../ui/control-rows';
import type { NumberFieldProps } from '../ui/number-field';
import type { SegmentedProps } from '../ui/segmented';
import type { SelectOption, SelectProps } from '../ui/select';
import type { StatusMessageProps } from '../ui/status-message';
import type { StudioController, StudioState } from './controller';

export type DesignNumberSetting = keyof typeof designNumberConstraints;

// === DESIGN SETTINGS ===

/**
 * Binds a numeric design setting to a slider, replacing `DesignRange`: the row id is the setting
 * name, bounds come from `designNumberConstraints`, and the output reads
 * `Number(value.toFixed(2))` followed by `unit` (the legacy `suffix`, e.g. " px").
 */
export function designRangeRow(
  controller: StudioController,
  state: StudioState,
  setting: DesignNumberSetting,
  label: string,
  unit?: string,
): RangeRow {
  const [min, max, step] = designNumberConstraints[setting];

  return {
    kind: 'range',
    id: setting,
    label,
    value: state.design[setting],
    min,
    max,
    step,
    unit,
    onChange: (value) => controller.design({ [setting]: value }),
  };
}

// === OPTION ROWS (generic at the call site) ===

export function selectRow<T extends string>(
  id: string,
  props: Omit<SelectProps<T>, 'id'>,
): SelectRow {
  const values = props.options.flatMap(listSelectOptionValues);

  return {
    ...props,
    kind: 'select',
    id,
    onChange: (value) => {
      props.onChange(findOptionValue(id, values, value));
    },
  };
}

export function segmentedRow<T extends string>(id: string, props: SegmentedProps<T>): SegmentedRow {
  const values = props.options.map((option) => option.value);

  return {
    ...props,
    kind: 'segmented',
    id,
    onChange: (value) => {
      props.onChange(findOptionValue(id, values, value));
    },
  };
}

export function tilesRow<T extends string>(id: string, props: ChoiceTilesProps<T>): TilesRow {
  const { isPressedComputed } = props;
  const values = props.options.map((option) => option.value);

  return {
    ...props,
    kind: 'tiles',
    id,
    onChange: (value) => {
      props.onChange(findOptionValue(id, values, value));
    },
    isPressedComputed:
      isPressedComputed === undefined
        ? undefined
        : (option) =>
            isPressedComputed({ ...option, value: findOptionValue(id, values, option.value) }),
  };
}

// === PLAIN ROWS ===

export function toggleRow(id: string, props: ToggleRowProps): ToggleRow {
  return { ...props, kind: 'toggle', id };
}

export function numberRow(id: string, props: Omit<NumberFieldProps, 'id'>): NumberRow {
  return { ...props, kind: 'number', id };
}

export function colourRow(id: string, props: Omit<ColorFieldProps, 'id'>): ColourRow {
  return { ...props, kind: 'colour', id };
}

export function hintRow(id: string, children: ReactNode): HintRow {
  return { kind: 'hint', id, children };
}

export function statusRow(id: string, props: Omit<StatusMessageProps, 'id'>): StatusRow {
  const { kind: statusKind, ...statusProps } = props;

  return { ...statusProps, kind: 'status', id, statusKind };
}

export function buttonRow(id: string, props: ButtonProps): ButtonRow {
  return { ...props, kind: 'button', id };
}

export function customRow(id: string, render: () => ReactNode): CustomRow {
  return { kind: 'custom', id, render };
}

// === HELPERS ===

function listSelectOptionValues<T extends string>(option: SelectOption<T>): T[] {
  if (typeof option === 'string') {
    return [option];
  }

  return 'group' in option ? option.options.map((item) => item.value) : [option.value];
}

/** Recovers the typed value from the erased string the primitive reported. */
function findOptionValue<T extends string>(rowId: string, values: readonly T[], value: string): T {
  const match = values.find((candidate) => candidate === value);

  if (match === undefined) {
    throw new Error(
      `Row "${rowId}" received "${value}", which is not one of its options (${values.join(', ')}). Build the row's options and value from the same list.`,
    );
  }

  return match;
}
