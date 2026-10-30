import assert from 'node:assert/strict';
import test from 'node:test';
import { renderMarkup } from '../test-helpers';
import { RouteLine } from './route-line';

const points = [
  { x: 10, y: 20.04 },
  { x: 110, y: 80 },
];

void test('RouteLine draws the halo under the line from the same polyline', () => {
  const markup = renderMarkup(
    <RouteLine widthPx={200} heightPx={100} points={points} waypoints={[]} label="Route: Ridge" />,
  );

  assert.ok(markup.includes('class="lc-route-line__halo" points="10,20 110,80"'));
  assert.ok(markup.indexOf('lc-route-line__halo') < markup.indexOf('lc-route-line__line'));
  assert.ok(markup.includes('viewBox="0 0 200 100"'));
});

void test('RouteLine marks each waypoint with a diamond and its name', () => {
  const markup = renderMarkup(
    <RouteLine
      widthPx={200}
      heightPx={100}
      points={points}
      waypoints={[{ x: 50, y: 40, name: 'Summit' }]}
      label="Route: Ridge"
    />,
  );

  assert.ok(markup.includes('data-route-waypoints="1"'));
  assert.ok(markup.includes('data-kind="waypoint"'));
  assert.ok(markup.includes('style="left:50px;top:40px"'));
  assert.ok(markup.includes('<span class="lc-route-line__label">Summit</span>'));
});

void test('RouteLine is one named image and counts its points for tests', () => {
  const markup = renderMarkup(
    <RouteLine widthPx={200} heightPx={100} points={points} waypoints={[]} label="Route: Ridge" />,
  );

  assert.ok(markup.includes('role="img" aria-label="Route: Ridge"'));
  assert.ok(markup.includes('data-route-points="2"'));
});

void test('RouteLine with an empty route renders no waypoints and an empty polyline', () => {
  const markup = renderMarkup(
    <RouteLine widthPx={200} heightPx={100} points={[]} waypoints={[]} label="Route" />,
  );

  assert.ok(!markup.includes('lc-route-line__waypoint'));
  assert.ok(markup.includes('points=""'));
});
