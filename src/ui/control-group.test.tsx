import assert from 'node:assert/strict';
import test from 'node:test';
import { ControlGroup } from './control-group';
import {
  controlRowKinds,
  type ControlGroupDefinition,
  type ControlRow,
  type ControlRowKind,
} from './control-rows';
import { renderMarkup } from './test-helpers';

const noop = (): void => undefined;

const rowsByKind: Record<ControlRowKind, ControlRow> = {
  toggle: { kind: 'toggle', id: 'lock-seed', label: 'Lock seed', value: true, onChange: noop },
  range: {
    kind: 'range',
    id: 'camera-exposure',
    label: 'Exposure',
    value: 0.5,
    min: -2,
    max: 2,
    step: 0.1,
    unit: ' EV',
    onChange: noop,
  },
  select: {
    kind: 'select',
    id: 'terrain-place',
    label: 'Location',
    value: 'b',
    options: [
      { value: 'a', label: 'Ben Nevis' },
      { value: 'b', label: 'Snowdon' },
    ],
    onChange: noop,
  },
  segmented: {
    kind: 'segmented',
    id: 'camera-projection',
    label: 'Projection',
    value: 'perspective',
    options: [
      { value: 'perspective', label: 'Perspective' },
      { value: 'orthographic', label: 'Axonometric' },
    ],
    onChange: noop,
  },
  number: {
    kind: 'number',
    id: 'terrain-max-depth',
    label: 'Maximum depth',
    value: 50,
    unit: 'm',
    onChange: noop,
  },
  pair: {
    kind: 'pair',
    id: 'terrain-coordinates',
    fields: [
      { kind: 'number', id: 'terrain-latitude', label: 'Latitude', value: 53, onChange: noop },
      { kind: 'text', id: 'plaque-text', label: 'Plaque', value: 'Snowdon', onChange: noop },
    ],
  },
  colour: {
    kind: 'colour',
    id: 'road-color',
    label: 'Road color',
    value: '#b4b4b4',
    onChange: noop,
  },
  tiles: {
    kind: 'tiles',
    id: 'frame-style',
    label: 'Frame style',
    value: 'tray',
    options: [
      { value: 'none', label: 'None' },
      { value: 'tray', label: 'Tray' },
    ],
    onChange: noop,
  },
  hint: { kind: 'hint', id: 'seed-hint', children: 'Locations are session-only.' },
  status: { kind: 'status', id: 'roads-status', statusKind: 'info', children: 'Downloading roads' },
  link: {
    kind: 'link',
    id: 'roads-attribution',
    label: '© OpenStreetMap contributors',
    href: 'https://www.openstreetmap.org/copyright',
    isExternal: true,
  },
  button: { kind: 'button', id: 'new-landscape', variant: 'primary', children: 'New landscape' },
  buttons: {
    kind: 'buttons',
    id: 'view-presets',
    label: 'View presets',
    buttons: [
      { key: 'top', children: 'Top', onClick: noop },
      { key: 'side', children: 'Side', onClick: noop },
    ],
  },
  custom: { kind: 'custom', id: 'crop-preview', render: () => <div data-custom="crop" /> },
};

function renderGroup(group: Partial<ControlGroupDefinition>, code?: string): string {
  return renderMarkup(
    <ControlGroup group={{ id: 'frame', title: 'Frame', rows: [], ...group }} code={code} />,
  );
}

void test('ControlGroup is a fieldset named by a plain-title legend, code kept decorative', () => {
  const markup = renderGroup({}, 'FRAM.01');

  assert.match(
    markup,
    /^<fieldset class="lc-group" data-group-id="frame"><legend class="lc-group__legend">Frame<\/legend>/,
  );
  assert.match(markup, /aria-hidden="true">FRAM\.01</);
});

void test('ControlGroup renders a row for every row kind with the row id in the DOM', () => {
  const rows = controlRowKinds.map((kind) => rowsByKind[kind]);
  const markup = renderGroup({ rows });

  for (const row of rows) {
    assert.ok(markup.includes(`id="${row.id}"`), `${row.kind} row id "${row.id}" missing`);
  }
});

void test('ControlGroup binds field ids to native controls and slider outputs', () => {
  const markup = renderGroup({
    rows: [rowsByKind.range, rowsByKind.select, rowsByKind.number, rowsByKind.colour],
  });

  assert.match(markup, /<output class="lc-ruler-slider__value" for="camera-exposure">/);
  assert.match(markup, /<select class="lc-select__control" id="terrain-place"/);
  assert.match(markup, /<input class="lc-field__input" id="terrain-max-depth" type="number"/);
  assert.match(markup, /<input class="lc-color-field__input" id="road-color" type="color"/);
});

void test('ControlGroup renders toggles as switches unless they ask for a checkbox', () => {
  const markup = renderGroup({
    rows: [
      rowsByKind.toggle,
      {
        kind: 'toggle',
        id: 'part-base',
        appearance: 'checkbox',
        label: 'Base',
        value: false,
        onChange: noop,
      },
    ],
  });

  assert.match(markup, /id="lock-seed" type="checkbox" role="switch"/);
  assert.match(markup, /<label class="lc-checkbox" for="part-base">/);
  assert.ok(!markup.includes('appearance='));
});

void test('ControlGroup skips false and undefined row entries', () => {
  const markup = renderGroup({ rows: [false, rowsByKind.hint, undefined] });

  assert.equal(markup.match(/class="lc-group__hint"/g)?.length, 1);
});

void test('ControlGroup throws on a duplicate row id, naming the group and id', () => {
  assert.throws(
    () => renderGroup({ rows: [rowsByKind.hint, { ...rowsByKind.toggle, id: 'seed-hint' }] }),
    /ControlGroup "frame" has more than one row with id "seed-hint"/,
  );
});

void test('ControlGroup treats pair field ids as row ids when checking duplicates', () => {
  assert.throws(
    () => renderGroup({ rows: [rowsByKind.pair, { ...rowsByKind.hint, id: 'terrain-latitude' }] }),
    /id "terrain-latitude"/,
  );
});

void test('ControlGroup shows the pin button only for pinnable groups given onPin', () => {
  const group = { id: 'frame', title: 'Frame', rows: [] };
  const pinnable = renderMarkup(
    <ControlGroup group={{ ...group, isPinnable: true }} onPin={noop} />,
  );
  const withoutHandler = renderMarkup(<ControlGroup group={{ ...group, isPinnable: true }} />);
  const notPinnable = renderMarkup(<ControlGroup group={group} onPin={noop} />);

  assert.match(pinnable, /aria-label="Pin Frame"/);
  assert.ok(!withoutHandler.includes('Pin Frame'));
  assert.ok(!notPinnable.includes('Pin Frame'));
});

void test('an external link row opens a new tab and says so in its accessible name', () => {
  const markup = renderGroup({ rows: [rowsByKind.link] });

  assert.match(markup, /target="_blank" rel="noreferrer"/);
  assert.match(markup, /<span class="lc-group__link-glyph" aria-hidden="true">↗<\/span>/);
  assert.ok(markup.includes('(opens in a new tab)'));
});

void test('a status row maps statusKind to the status message kind and keeps its live role', () => {
  const markup = renderGroup({ rows: [rowsByKind.status] });

  assert.match(
    markup,
    /id="roads-status" class="lc-status-message" data-kind="info" role="status"/,
  );
  assert.ok(!markup.includes('statusKind'));
});

void test('a buttons row is a labelled group and does not leak item keys', () => {
  const markup = renderGroup({ rows: [rowsByKind.buttons] });

  assert.match(markup, /id="view-presets" role="group" aria-label="View presets"/);
  assert.ok(!markup.includes('key='));
});
