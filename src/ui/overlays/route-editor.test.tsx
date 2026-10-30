import assert from 'node:assert/strict';
import test from 'node:test';
import { renderMarkup } from '../test-helpers';
import { RouteEditor, type RouteEditorProps } from './route-editor';

const noop = () => undefined;
const points = [
  { xPx: 10, yPx: 20 },
  { xPx: 50, yPx: 60 },
  { xPx: 90, yPx: 20 },
];

function render(overrides: Partial<RouteEditorProps> = {}): string {
  return renderMarkup(
    <RouteEditor
      points={points}
      isPlacing={false}
      onSurfacePointer={noop}
      onSelect={noop}
      onMove={noop}
      onInsert={noop}
      {...overrides}
    />,
  );
}

void test('RouteEditor gives each waypoint a numbered, named handle with start and end marked', () => {
  const markup = render();

  assert.ok(markup.includes('aria-label="Waypoint 1"'));
  assert.ok(markup.includes('aria-label="Waypoint 3"'));
  assert.ok(markup.includes('data-end="start"'));
  assert.ok(markup.includes('data-end="end"'));
  assert.equal(markup.match(/data-route-handle=/g)?.length, 3);
});

void test('RouteEditor offers one insert target per segment at its midpoint', () => {
  const markup = render();

  assert.equal(markup.match(/lc-route-editor__insert/g)?.length, 2);
  assert.ok(markup.includes('aria-label="Insert waypoint after 1"'));
  assert.ok(markup.includes('--lc-route-editor-x:30px;--lc-route-editor-y:40px'));
});

void test('RouteEditor marks only the selected handle as pressed', () => {
  const markup = render({ selectedIndex: 1 });

  assert.equal(markup.match(/aria-pressed="true"/g)?.length, 1);
  assert.ok(markup.includes('aria-label="Waypoint 2" aria-pressed="true"'));
});

void test('RouteEditor takes the open canvas only while placing', () => {
  assert.ok(!render().includes('lc-route-editor__surface'));
  assert.ok(render({ isPlacing: true }).includes('lc-route-editor__surface'));
});

void test('RouteEditor skips handles and targets for points the view cannot place', () => {
  const markup = render({ points: [points[0], undefined, points[2]] });

  assert.equal(markup.match(/data-route-handle=/g)?.length, 2);
  assert.ok(!markup.includes('lc-route-editor__insert'));
});
