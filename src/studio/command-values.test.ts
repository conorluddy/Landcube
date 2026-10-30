import assert from 'node:assert/strict';
import test from 'node:test';
import type { ControlRow } from '../ui/control-rows';
import { describeValueControls } from './command-values';

void test('a range offers min, middle, max and the current value ± ten steps', () => {
  const [control] = describeValueControls({
    kind: 'range',
    id: 'strokeWidth',
    label: 'Weight',
    value: 1.2,
    min: 0.2,
    max: 4,
    step: 0.1,
    unit: ' px',
    onChange: () => undefined,
  });

  assert.equal(control.current, '1.2 px');
  assert.deepEqual(
    control.quickValues.map(({ label }) => label),
    ['0.2 px', '2.1 px', '2.2 px', '4 px'],
  );
});

void test('a range applies a typed number snapped to its step', () => {
  const received: number[] = [];
  const [control] = describeValueControls({
    kind: 'range',
    id: 'gridSpacing',
    label: 'Spacing',
    value: 20,
    min: 10,
    max: 100,
    step: 5,
    onChange: (value) => received.push(value),
  });

  assert.equal(control.apply('25 m').ok, true);
  assert.equal(control.apply('27').ok, true);
  assert.equal(control.apply('abc').ok, false);
  assert.deepEqual(received, [25, 25]);
});

void test('a stop slider shows its display value and offers no quick values', () => {
  const [control] = describeValueControls({
    kind: 'range',
    id: 'terrain-span',
    label: 'Area span',
    value: 15,
    min: 0,
    max: 31,
    step: 1,
    displayValue: '25 km',
    onChange: () => undefined,
  });

  assert.equal(control.current, '25 km');
  assert.deepEqual(control.quickValues, []);
});

void test('a toggle offers On and Off and accepts on/off words', () => {
  const received: boolean[] = [];
  const [control] = describeValueControls({
    kind: 'toggle',
    id: 'cursorEnabled',
    label: 'Cursor',
    value: false,
    onChange: (value) => received.push(value),
  });

  assert.equal(control.current, 'Off');
  assert.deepEqual(control.quickValues, [
    { label: 'On', value: 'on' },
    { label: 'Off', value: 'off' },
  ]);
  assert.equal(control.apply('ON').ok, true);
  assert.equal(control.apply('maybe').ok, false);
  assert.deepEqual(received, [true]);
});

void test('select, segmented and tiles offer each option and match value or label', () => {
  const received: string[] = [];
  const rows: ControlRow[] = [
    {
      kind: 'select',
      id: 'terrain-contour-mode',
      label: 'Interval mode',
      value: 'auto',
      options: [
        { group: 'Modes', options: [{ value: 'auto', label: 'Auto' }] },
        { value: 'fixed', label: 'Fixed interval' },
      ],
      onChange: (value) => received.push(value),
    },
    {
      kind: 'segmented',
      id: 'rotation-direction',
      label: 'Direction',
      value: 'auto',
      options: [
        { value: 'auto', label: 'Auto' },
        { value: 'fixed', label: 'Fixed interval' },
      ],
      onChange: (value) => received.push(value),
    },
    {
      kind: 'tiles',
      id: 'palette',
      label: 'Palette',
      value: 'auto',
      options: [
        { value: 'auto', label: 'Auto' },
        { value: 'fixed', label: 'Fixed interval' },
      ],
      onChange: (value) => received.push(value),
    },
  ];

  for (const row of rows) {
    const [control] = describeValueControls(row);

    assert.equal(control.current, 'Auto', row.kind);
    assert.deepEqual(
      control.quickValues.map(({ value }) => value),
      ['auto', 'fixed'],
      row.kind,
    );
    assert.equal(control.apply('fixed interval').ok, true, row.kind);
    assert.equal(control.apply('nope').ok, false, row.kind);
  }

  assert.deepEqual(received, ['fixed', 'fixed', 'fixed']);
});

void test('a colour offers no quick values and normalises hex input', () => {
  const received: string[] = [];
  const [control] = describeValueControls({
    kind: 'colour',
    id: 'lineColor',
    label: 'Contour color',
    value: '#ffffff',
    onChange: (value) => received.push(value),
  });

  assert.deepEqual(control.quickValues, []);
  assert.equal(control.apply('AABBCC').ok, true);
  assert.equal(control.apply('red').ok, false);
  assert.deepEqual(received, ['#aabbcc']);
});

void test('a number pair yields one control per field, and a rejected value is reported', () => {
  const controls = describeValueControls({
    kind: 'pair',
    id: 'terrain-coordinates',
    fields: [
      {
        kind: 'number',
        id: 'terrain-latitude',
        label: 'Latitude',
        value: 1,
        min: -85,
        max: 85,
        onChange: () => false,
      },
      {
        kind: 'number',
        id: 'terrain-longitude',
        label: 'Longitude',
        value: 2,
        onChange: () => true,
      },
    ],
  });

  assert.deepEqual(
    controls.map(({ id }) => id),
    ['terrain-latitude', 'terrain-longitude'],
  );
  assert.equal(controls[0].apply('90').ok, false);
  assert.equal(controls[0].apply('10').ok, false);
  assert.equal(controls[1].apply('10').ok, true);
});

void test('a disabled control refuses every value', () => {
  const [control] = describeValueControls({
    kind: 'toggle',
    id: 'scene-map-grid',
    label: 'Map grid',
    value: false,
    disabled: true,
    onChange: () => assert.fail('a disabled row must not change'),
  });

  assert.equal(control.apply('on').ok, false);
});

void test('rows without a value describe nothing', () => {
  assert.deepEqual(describeValueControls({ kind: 'hint', id: 'hint', children: 'Hint' }), []);
  assert.deepEqual(
    describeValueControls({ kind: 'button', id: 'go', children: 'Go', onClick: () => undefined }),
    [],
  );
});
