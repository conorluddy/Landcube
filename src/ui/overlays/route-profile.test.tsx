import assert from 'node:assert/strict';
import test from 'node:test';
import { renderMarkup } from '../test-helpers';
import {
  chooseTicks,
  commitSlopeThreshold,
  moveInspection,
  RouteProfile,
  splitElevationRuns,
  type RouteProfileProps,
} from './route-profile';

const point = { latitude: 0, longitude: 0 };
const samples = [
  { distanceMeters: 0, point, elevationMeters: 100 },
  { distanceMeters: 250, point, elevationMeters: 140 },
  { distanceMeters: 500, point },
  { distanceMeters: 750, point, elevationMeters: 90 },
  { distanceMeters: 1000, point, elevationMeters: 60 },
];

function render(overrides: Partial<RouteProfileProps> = {}): string {
  return renderMarkup(
    <RouteProfile
      summary={{
        status: 'ready',
        ground: '1.0 km',
        ascent: '40 m',
        descent: '80 m',
        net: '-40 m',
        isPartial: true,
        isTerrainDerived: true,
      }}
      profile={{
        groundMeters: 1000,
        samples,
        steepSections: [
          { startMeters: 0, endMeters: 250, direction: 'climb' },
          { startMeters: 750, endMeters: 1000, direction: 'descent' },
        ],
      }}
      slopeThresholdPercent={15}
      isCollapsed={false}
      onCollapsedChange={() => undefined}
      onInspect={() => undefined}
      onThresholdChange={() => undefined}
      {...overrides}
    />,
  );
}

void test('a missing elevation splits the chart into separate runs and is never bridged', () => {
  const runs = splitElevationRuns(samples);

  assert.deepEqual(
    runs.map((run) => run.map(({ distanceMeters }) => distanceMeters)),
    [
      [0, 250],
      [750, 1000],
    ],
  );
  assert.equal(render().match(/<polyline/g)?.length, 2);
});

void test('steep spans carry both a colour class and a text label', () => {
  const markup = render();

  assert.ok(markup.includes('lc-route-profile__band--climb'));
  assert.ok(markup.includes('lc-route-profile__band--descent'));
  assert.ok(markup.includes('>Steep climb<'));
  assert.ok(markup.includes('>Steep descent<'));
});

void test('the chart is a slider whose value text names distance and elevation', () => {
  const markup = render({ inspectedDistanceMeters: 250 });

  assert.ok(markup.includes('role="slider"'));
  assert.ok(markup.includes('tabindex="0"'));
  assert.ok(markup.includes('aria-valuetext="250 m, elevation 140 m"'));
  assert.ok(markup.includes('data-route-cursor="250"'));
});

void test('value text says when the inspected spot has no elevation data', () => {
  assert.ok(render({ inspectedDistanceMeters: 500 }).includes('500 m, no elevation data'));
});

void test('keys move the inspection by 1% and 10% steps and clamp to the route', () => {
  assert.equal(moveInspection('ArrowRight', 500, 1000), 510);
  assert.equal(moveInspection('ArrowLeft', 500, 1000), 490);
  assert.equal(moveInspection('PageUp', 500, 1000), 600);
  assert.equal(moveInspection('PageDown', 50, 1000), 0);
  assert.equal(moveInspection('Home', 500, 1000), 0);
  assert.equal(moveInspection('End', 500, 1000), 1000);
  assert.equal(moveInspection('ArrowRight', 1000, 1000), 1000);
  assert.equal(moveInspection('a', 500, 1000), undefined);
});

void test('thresholds of 1, 15 and 100 are applied; 0 and 101 are rejected (REQ-27, 28)', () => {
  const applied: number[] = [];

  for (const percent of [1, 15, 100]) {
    assert.equal(
      commitSlopeThreshold(percent, (value) => applied.push(value)),
      true,
    );
  }

  for (const percent of [0, 101, undefined]) {
    assert.equal(
      commitSlopeThreshold(percent, (value) => applied.push(value)),
      false,
    );
  }

  assert.deepEqual(applied, [1, 15, 100]);
});

void test('the header shows the summary flags and the threshold defaults to 15', () => {
  const markup = render();

  assert.ok(markup.includes('>Partial<'));
  assert.ok(markup.includes('>Terrain-derived<'));
  assert.ok(markup.includes('value="15"'));
});

void test('collapsing hides the body but keeps the header summary', () => {
  const markup = render({ isCollapsed: true });

  assert.ok(markup.includes('data-route-profile="collapsed"'));
  assert.ok(markup.includes('aria-expanded="false"'));
  assert.ok(/class="lc-route-profile__body"[^>]*hidden/.test(markup));
  assert.ok(markup.includes('1.0 km'));
});

void test('an incomplete route shows a message instead of a profile', () => {
  const markup = render({
    summary: { status: 'incomplete', isPartial: false, isTerrainDerived: false },
    profile: undefined,
  });

  assert.ok(markup.includes('Incomplete route'));
  assert.ok(!markup.includes('role="slider"'));
});

void test('ticks are round numbers that cover the range', () => {
  assert.deepEqual(chooseTicks(0, 1000, 4), [0, 500, 1000]);

  const ticks = chooseTicks(87, 143, 3);

  assert.ok(ticks[0] <= 87);
  assert.ok((ticks.at(-1) ?? 0) >= 143);
});
