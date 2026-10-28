import assert from 'node:assert/strict';
import test from 'node:test';
import { createGrassCoverage, surveyGrassGround, type GrassCoverageMap } from './grass-coverage';
import { getDecorationRoads, type DecorationSite } from './decoration-field';
import { defaultGrassStyle } from './constants/grass';
import { defaultRoadStyle } from './constants/roads';
import { getRoadHalfWidth } from './road-ribbons';
import type { GrassStyle } from './types/grass';
import type { HeightField } from './types/terrain';

/** A gentle tilt, 2 m per frame unit horizontally at 10 m per frame unit: about 11° everywhere. */
function createField(slopePerUnit = 0.002, columns = 101, rows = 101): HeightField {
  return {
    columns,
    rows,
    originX: 0,
    originY: 0,
    spacing: 5,
    values: Float64Array.from(
      { length: columns * rows },
      (_, index) => (index % columns) * 5 * slopePerUnit,
    ),
  };
}

function createSite(overrides: Partial<DecorationSite> = {}): DecorationSite {
  return {
    field: createField(),
    width: 500,
    height: 500,
    shape: 'rectangle',
    originX: 0,
    originY: 0,
    frameUnitsPerMm: 4,
    metersPerFieldUnit: 1000,
    metersPerFrameUnit: 10,
    roads: [],
    ...overrides,
  };
}

const style = { ...defaultGrassStyle, coverage: 1, altitudeLimit: 1 };
// 5 frame units a texel keeps crop offsets on texel centres, so cropped maps line up exactly.
const resolution = 100;

function grow(
  site: DecorationSite,
  coverageStyle: GrassStyle,
  resolution: number,
): GrassCoverageMap {
  return createGrassCoverage(surveyGrassGround(site, resolution), coverageStyle);
}

/** Growth (0..255) at a crop point, read from the texel containing it. */
function growthAt(map: GrassCoverageMap, site: DecorationSite, x: number, y: number): number {
  const column = Math.min(map.columns - 1, Math.floor((x / site.width) * map.columns));
  const row = Math.min(map.rows - 1, Math.floor((y / site.height) * map.rows));

  return map.data[(row * map.columns + column) * 4];
}

function totalGrowth(map: GrassCoverageMap): number {
  let total = 0;

  for (let offset = 0; offset < map.data.length; offset += 4) {
    total += map.data[offset];
  }

  return total;
}

void test('the same site and style always grow the same coverage', () => {
  const first = grow(createSite(), style, resolution);
  const second = grow(createSite(), style, resolution);

  assert.equal(first.columns, 100);
  assert.equal(first.rows, 100);
  assert.deepEqual(first.data, second.data);
  assert.ok(totalGrowth(first) > 0);
});

void test('patches are anchored to the source, so cropping never reshapes them', () => {
  const site = createSite({ field: createField(0.002, 201, 201), width: 1000, height: 1000 });
  const partial = { ...style, coverage: 0.5 };
  const whole = grow(site, partial, 200);
  const cropped = grow(
    { ...site, width: 500, height: 500, originX: 250, originY: 125 },
    partial,
    100,
  );

  // The cropped field is the same terrain, so only the frame offset differs.
  for (let row = 0; row < cropped.rows; row++) {
    for (let column = 0; column < cropped.columns; column++) {
      const inner = (row * cropped.columns + column) * 4;
      const outer = ((row + 25) * whole.columns + column + 50) * 4;

      assert.equal(cropped.data[inner + 1], whole.data[outer + 1], 'dry patches moved');
    }
  }
});

void test('grass keeps off roads and out of the sea', () => {
  const road = {
    points: [
      { x: 0, y: 250 },
      { x: 500, y: 250 },
    ],
    halfWidth: 8,
  };
  const site = createSite({ roads: [road] });
  const withRoad = grow(site, style, resolution);

  assert.equal(growthAt(withRoad, site, 100, 250), 0, 'grass grows on the road');
  assert.ok(growthAt(withRoad, site, 100, 100) > 0);

  // The field rises 0.002 a unit from 0 in the west, so a sea level of 0.25 floods x < 125.
  const coastal = createSite({ seaLevel: 0.25 });
  const coast = grow(coastal, style, resolution);

  assert.equal(growthAt(coast, coastal, 60, 300), 0, 'grass grows in the sea');
  assert.ok(growthAt(coast, coastal, 300, 300) > 0);
});

void test('slope limits use the real slope, so steep ground stays bare', () => {
  // 0.02 field units per frame unit is 20 m rise per 10 m run: about 63°.
  const cliff = grow(createSite({ field: createField(0.02) }), style, resolution);
  const gentle = grow(createSite(), style, resolution);

  assert.equal(totalGrowth(cliff), 0);
  assert.ok(totalGrowth(gentle) > 0);
});

void test('raising coverage only adds grass, never removes it', () => {
  const site = createSite();
  let previous = grow(site, { ...style, coverage: 0 }, resolution);

  assert.equal(totalGrowth(previous), 0);

  for (const coverage of [0.25, 0.5, 0.75, 1]) {
    const next = grow(site, { ...style, coverage }, resolution);

    for (let offset = 0; offset < next.data.length; offset += 4) {
      assert.ok(next.data[offset] >= previous.data[offset], `coverage ${coverage} lost grass`);
    }

    previous = next;
  }
});

void test('circular crops grow nothing outside the circle', () => {
  const site = createSite({ shape: 'circle' });
  const map = grow(site, style, resolution);

  assert.equal(growthAt(map, site, 2, 2), 0);
  assert.ok(growthAt(map, site, 250, 250) > 0);
});

void test('one ground survey serves every style, including clumping changes', () => {
  const site = createSite();
  const ground = surveyGrassGround(site, resolution);

  for (const clumping of [0.5, 0, 1, 0.5]) {
    const patchy = { ...style, coverage: 0.6, clumping };

    assert.deepEqual(createGrassCoverage(ground, patchy).data, grow(site, patchy, resolution).data);
  }
});

void test('grass clears exactly the drawn roads: their classes and widths, none when roads are off', () => {
  const paths = [
    {
      roadClass: 'primary' as const,
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
    },
    {
      roadClass: 'track' as const,
      points: [
        { x: 0, y: 5 },
        { x: 10, y: 5 },
      ],
    },
  ];
  const style = { ...defaultRoadStyle, enabled: true, widthMm: 1 };
  const major = getDecorationRoads(paths, { ...style, detail: 'major' }, 4);

  assert.deepEqual(
    major.map((road) => road.halfWidth),
    [getRoadHalfWidth('primary', 1, 4)],
  );
  assert.equal(getDecorationRoads(paths, { ...style, detail: 'tracks' }, 4).length, 2);
  assert.deepEqual(getDecorationRoads(paths, { ...style, enabled: false }, 4), []);
});

void test('patches are sized in printed millimetres, whatever window size the frame came from', () => {
  const small = createSite();
  const large = createSite({
    field: createField(0.001, 201, 201),
    width: 1000,
    height: 1000,
    frameUnitsPerMm: 8,
  });
  const patchy = { ...style, coverage: 0.5 };

  assert.deepEqual(grow(large, patchy, resolution).data, grow(small, patchy, resolution).data);
});
