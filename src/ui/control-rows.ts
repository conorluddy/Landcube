/*
 * Typed row model for ControlGroup (C-05). Types only.
 *
 * Every row carries `id` plus the matching primitive's props with option generics erased to
 * `string`. Type safety for option values lives in the studio's row factories
 * (`src/studio/control-rows.ts`), which keep the generic at the call site.
 *
 * `id` is a DOM id and the command-palette key, so it must be unique across the studio:
 * - toggle, range, select, number, colour: the id of the native control (`#terrain-place`,
 *   `output[for="camera-exposure"]` depend on this).
 * - hint, status, link: the id of the rendered paragraph, status element or anchor.
 * - segmented, tiles, pair, button, buttons, custom: the id of the row's wrapper element.
 */
import type { ReactNode } from 'react';
import type { ButtonProps } from './button';
import type { CheckboxProps } from './checkbox';
import type { ChoiceTilesProps } from './choice-tiles';
import type { ColorFieldProps } from './color-field';
import type { NumberFieldProps } from './number-field';
import type { RulerSliderProps } from './ruler-slider';
import type { SegmentedProps } from './segmented';
import type { SelectProps } from './select';
import type { StatusMessageKind, StatusMessageProps } from './status-message';
import type { SwitchProps } from './switch';
import type { TextFieldProps } from './text-field';

// === ROW KINDS ===

export const controlRowKinds = [
  'toggle',
  'range',
  'select',
  'segmented',
  'number',
  'pair',
  'colour',
  'tiles',
  'hint',
  'status',
  'link',
  'button',
  'buttons',
  'custom',
] as const;

export type ControlRowKind = (typeof controlRowKinds)[number];

interface RowIdentity<Kind extends ControlRowKind> {
  kind: Kind;
  id: string;
}

// === ROWS ===

/** A Switch by default; `appearance: 'checkbox'` for list-like choices such as export parts. */
export type ToggleRowProps =
  | ({ appearance?: 'switch' } & Omit<SwitchProps, 'id'>)
  | ({ appearance: 'checkbox' } & Omit<CheckboxProps, 'id'>);

export type ToggleRow = RowIdentity<'toggle'> & ToggleRowProps;
export type RangeRow = RowIdentity<'range'> & Omit<RulerSliderProps, 'id'>;
export type SelectRow = RowIdentity<'select'> & Omit<SelectProps<string>, 'id'>;
export type SegmentedRow = RowIdentity<'segmented'> & SegmentedProps<string>;
export type NumberRow = RowIdentity<'number'> & Omit<NumberFieldProps, 'id'>;
export type ColourRow = RowIdentity<'colour'> & Omit<ColorFieldProps, 'id'>;
export type TilesRow = RowIdentity<'tiles'> & ChoiceTilesProps<string>;

/** One half of a `pair` row. Its `id` is the input's DOM id (`terrain-latitude`). */
export type PairFieldDescriptor =
  | ({ kind: 'number'; id: string } & Omit<NumberFieldProps, 'id'>)
  | ({ kind: 'text'; id: string } & Omit<TextFieldProps, 'id'>);

export type PairRow = RowIdentity<'pair'> & {
  fields: readonly [PairFieldDescriptor, PairFieldDescriptor];
};

export type HintRow = RowIdentity<'hint'> & { children: ReactNode };
/** `kind` names the row, so StatusMessage's own `kind` travels as `statusKind`. */
export type StatusRow = RowIdentity<'status'> & {
  statusKind: StatusMessageKind;
} & Omit<StatusMessageProps, 'id' | 'kind'>;

/** `isExternal` opens a new tab and appends "(opens in a new tab)" to the accessible name. */
export type LinkRow = RowIdentity<'link'> & { label: string; href: string; isExternal?: boolean };

export type ButtonRow = RowIdentity<'button'> & ButtonProps;

/** `key` identifies the button within the row; it is not rendered. */
export type ButtonRowItem = ButtonProps & { key: string };

/** A labelled `role="group"` of buttons, such as the orbit view presets. */
export type ButtonsRow = RowIdentity<'buttons'> & {
  label: string;
  buttons: readonly ButtonRowItem[];
};

/** Escape hatch for the place search, gradient editor and crop preview host. */
export type CustomRow = RowIdentity<'custom'> & { render: () => ReactNode };

export type ControlRow =
  | ToggleRow
  | RangeRow
  | SelectRow
  | SegmentedRow
  | NumberRow
  | PairRow
  | ColourRow
  | TilesRow
  | HintRow
  | StatusRow
  | LinkRow
  | ButtonRow
  | ButtonsRow
  | CustomRow;

/** `false` and `undefined` are skipped, so builders can write `isTray && row`. */
export type ControlRowEntry = ControlRow | false | undefined;

// === GROUPS ===

export interface ControlGroupDefinition {
  /** Registered in `src/studio/sections.ts`, which derives the group code from it. */
  id: string;
  /** Plain title; becomes the fieldset's accessible name. */
  title: string;
  rows: readonly ControlRowEntry[];
  /** Shows the pin button when ControlGroup also receives `onPin`. */
  isPinnable?: boolean;
}
