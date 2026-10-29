import type { ReactNode } from 'react';
import { Button } from './button';
import { Checkbox } from './checkbox';
import { ChoiceTiles } from './choice-tiles';
import { ColorField } from './color-field';
import type {
  ControlGroupDefinition,
  ControlRow,
  ControlRowEntry,
  LinkRow,
  PairFieldDescriptor,
} from './control-rows';
import { FieldPair } from './field-pair';
import { GroupHeader } from './group-header';
import { IconButton } from './icon-button';
import { NumberField } from './number-field';
import { RulerSlider } from './ruler-slider';
import { Segmented } from './segmented';
import { Select } from './select';
import { StatusMessage } from './status-message';
import { Switch } from './switch';
import { TextField } from './text-field';

export interface ControlGroupProps {
  group: ControlGroupDefinition;
  /** Group code such as 'CONT.03', from the studio's section registry. */
  code?: string;
  /** Shown as a pin button only when the group is also `isPinnable`. */
  onPin?: () => void;
}

/** A titled fieldset of typed rows (C-05). Row ids become DOM ids; duplicates throw. */
export function ControlGroup({ group, code, onPin }: ControlGroupProps): React.JSX.Element {
  const rows = group.rows.filter(isVisibleRow);

  assertUniqueRowIds(group.id, rows);

  const pinButton =
    onPin !== undefined && group.isPinnable === true ? (
      <IconButton glyph="⇱" label={`Pin ${group.title}`} onClick={onPin} />
    ) : undefined;

  return (
    <fieldset className="lc-group" data-group-id={group.id}>
      <legend className="lc-group__legend">{group.title}</legend>
      <GroupHeader title={group.title} code={code} trailing={pinButton} />
      <div className="lc-group__rows">
        {rows.map((row) => (
          <ControlRowView key={row.id} row={row} />
        ))}
      </div>
    </fieldset>
  );
}

// === ROWS ===

function ControlRowView({ row }: { row: ControlRow }): ReactNode {
  switch (row.kind) {
    case 'toggle':
      return row.appearance === 'checkbox' ? (
        <Checkbox {...omitAppearance(omitRowKind(row))} />
      ) : (
        <Switch {...omitAppearance(omitRowKind(row))} />
      );
    case 'range':
      return <RulerSlider {...omitRowKind(row)} />;
    case 'select':
      return <Select {...omitRowKind(row)} />;
    case 'number':
      return <NumberField {...omitRowKind(row)} />;
    case 'colour':
      return <ColorField {...omitRowKind(row)} />;
    case 'segmented':
      return (
        <div className="lc-group__row" id={row.id}>
          <Segmented {...omitRowKind(row)} />
        </div>
      );
    case 'tiles':
      return (
        <div className="lc-group__row" id={row.id}>
          <ChoiceTiles {...omitRowKind(row)} />
        </div>
      );
    case 'pair':
      return (
        <div className="lc-group__row" id={row.id}>
          <FieldPair>{[renderPairField(row.fields[0]), renderPairField(row.fields[1])]}</FieldPair>
        </div>
      );
    case 'hint':
      return (
        <p className="lc-group__hint" id={row.id}>
          {row.children}
        </p>
      );
    case 'status':
      return <StatusMessage {...omitStatusKind(omitRowKind(row))} kind={row.statusKind} />;
    case 'link':
      return <LinkRowView row={row} />;
    case 'button':
      return (
        <div className="lc-group__row" id={row.id}>
          <Button {...omitId(omitRowKind(row))} />
        </div>
      );
    case 'buttons':
      return (
        <div className="lc-group__buttons" id={row.id} role="group" aria-label={row.label}>
          {row.buttons.map((item) => (
            <Button key={item.key} {...omitKey(item)} />
          ))}
        </div>
      );
    case 'custom':
      return (
        <div className="lc-group__row" id={row.id}>
          {row.render()}
        </div>
      );
  }
}

function LinkRowView({ row }: { row: LinkRow }): React.JSX.Element {
  const isExternal = row.isExternal === true;

  return (
    <a
      className="lc-group__link"
      id={row.id}
      href={row.href}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noreferrer' : undefined}
    >
      {row.label}
      {isExternal && (
        <>
          <span className="lc-group__link-glyph" aria-hidden="true">
            ↗
          </span>
          <span className="lc-group__visually-hidden"> (opens in a new tab)</span>
        </>
      )}
    </a>
  );
}

function renderPairField(field: PairFieldDescriptor): ReactNode {
  return field.kind === 'number' ? (
    <NumberField key={field.id} {...omitRowKind(field)} />
  ) : (
    <TextField key={field.id} {...omitRowKind(field)} />
  );
}

// === HELPERS ===

// Parameter destructuring keeps the dropped keys out of the DOM without unused locals.
function omitRowKind<Row extends { kind: string }>({
  kind: _kind,
  ...props
}: Row): Omit<Row, 'kind'> {
  return props;
}

function omitAppearance<Props extends { appearance?: string }>({
  appearance: _appearance,
  ...props
}: Props): Omit<Props, 'appearance'> {
  return props;
}

function omitStatusKind<Props extends { statusKind: string }>({
  statusKind: _statusKind,
  ...props
}: Props): Omit<Props, 'statusKind'> {
  return props;
}

function omitId<Props extends { id: string }>({ id: _id, ...props }: Props): Omit<Props, 'id'> {
  return props;
}

function omitKey<Props extends { key: string }>({
  key: _key,
  ...props
}: Props): Omit<Props, 'key'> {
  return props;
}

function isVisibleRow(entry: ControlRowEntry): entry is ControlRow {
  return entry !== false && entry !== undefined;
}

/** Row ids are DOM ids and command-palette keys, so a repeat is a programming error. */
function assertUniqueRowIds(groupId: string, rows: readonly ControlRow[]): void {
  const seenIds = new Set<string>();
  const rowIds = rows.flatMap((row) =>
    row.kind === 'pair' ? [row.id, row.fields[0].id, row.fields[1].id] : [row.id],
  );

  for (const id of rowIds) {
    if (seenIds.has(id)) {
      throw new Error(
        `ControlGroup "${groupId}" has more than one row with id "${id}". Row ids become DOM ids and command-palette keys; give each row a unique id.`,
      );
    }

    seenIds.add(id);
  }
}
