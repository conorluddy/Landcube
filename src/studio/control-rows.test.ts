import assert from 'node:assert/strict';
import test from 'node:test';
import { designNumberConstraints } from '../constants/design';
import type { StudioController, StudioState } from './controller';
import {
  designRangeRow,
  segmentedRow,
  selectRow,
  statusRow,
  tilesRow,
  toggleRow,
} from './control-rows';

type Projection = 'perspective' | 'orthographic';

const projectionOptions = [
  { value: 'perspective', label: 'Perspective' },
  { value: 'orthographic', label: 'Axonometric' },
] as const satisfies readonly { value: Projection; label: string }[];

void test('segmentedRow round-trips the erased string back to the typed callback', () => {
  const received: Projection[] = [];
  const row = segmentedRow<Projection>('camera-projection', {
    label: 'Projection',
    value: 'perspective',
    options: projectionOptions,
    onChange: (projection) => {
      received.push(projection);
    },
  });

  row.onChange('orthographic');

  assert.equal(row.kind, 'segmented');
  assert.equal(row.id, 'camera-projection');
  assert.deepEqual(received, ['orthographic']);
});

void test('an option row throws when the erased value is not one of its options', () => {
  const row = segmentedRow<Projection>('camera-projection', {
    label: 'Projection',
    value: 'perspective',
    options: projectionOptions,
    onChange: () => undefined,
  });

  assert.throws(() => {
    row.onChange('fisheye');
  }, /Row "camera-projection" received "fisheye".*perspective, orthographic/);
});

void test('selectRow recovers values from flat, labelled and grouped options', () => {
  const received: string[] = [];
  const row = selectRow<'a' | 'b' | 'c'>('terrain-place', {
    label: 'Location',
    value: 'a',
    options: [
      'a',
      { value: 'b', label: 'B' },
      { group: 'More', options: [{ value: 'c', label: 'C' }] },
    ],
    onChange: (value) => {
      received.push(value);
    },
  });

  row.onChange('a');
  row.onChange('b');
  row.onChange('c');

  assert.deepEqual(received, ['a', 'b', 'c']);
});

void test('tilesRow passes typed options to a computed pressed state', () => {
  const row = tilesRow<Projection>('projection-tiles', {
    label: 'Projection',
    value: 'perspective',
    options: projectionOptions,
    onChange: () => undefined,
    isPressedComputed: (option) => option.value === 'orthographic',
  });

  assert.equal(row.isPressedComputed?.({ value: 'orthographic', label: 'Axonometric' }), true);
});

void test('statusRow carries the status message kind as statusKind', () => {
  const row = statusRow('roads-status', { kind: 'fault', isAlert: true, children: 'Failed' });

  assert.equal(row.kind, 'status');
  assert.equal(row.statusKind, 'fault');
  assert.equal(row.isAlert, true);
});

void test('toggleRow keeps the checkbox appearance', () => {
  const row = toggleRow('part-base', {
    appearance: 'checkbox',
    label: 'Base',
    value: true,
    onChange: () => undefined,
  });

  assert.equal(row.appearance, 'checkbox');
});

void test('designRangeRow mirrors DesignRange: setting id, constraints and a design patch', () => {
  const patches: unknown[] = [];
  const controller = {
    design: (patch: unknown) => {
      patches.push(patch);

      return true;
    },
  } as unknown as StudioController;
  const state = { design: { strokeWidth: 1.25 } } as unknown as StudioState;
  const row = designRangeRow(controller, state, 'strokeWidth', 'Weight', ' px');
  const [min, max, step] = designNumberConstraints.strokeWidth;

  row.onChange(2);

  assert.deepEqual(
    { id: row.id, value: row.value, min: row.min, max: row.max, step: row.step, unit: row.unit },
    { id: 'strokeWidth', value: 1.25, min, max, step, unit: ' px' },
  );
  assert.deepEqual(patches, [{ strokeWidth: 2 }]);
});
