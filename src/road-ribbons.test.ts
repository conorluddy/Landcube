import assert from 'node:assert/strict';
import test from 'node:test';
import { clipRoadsToCrop, createRoadRibbonBuffers, getSuggestedRoadWidthMm } from './road-ribbons';
import { projectToRealTerrainFrame } from './real-terrain-projection';
import { sampleHeightField, terrain3dElevationScale } from './terrain-surface';
import type { HeightField } from './types/terrain';
import type { MappedRoad, RoadPath } from './types/roads';

const placement = { location: { latitude: 53, longitude: -6.4 }, spanKm: 10 };
const sourceFrame = { width: 100, height: 100 };
const square = { shape: 'rectangle', width: 100, height: 100 } as const;
const circle = { shape: 'circle', width: 100, height: 100 } as const;

/** A tilted plane, so heights differ across a ribbon's width as well as along it. */
const field: HeightField = {
  columns: 21,
  rows: 21,
  originX: 0,
  originY: 0,
  spacing: 5,
  values: Float64Array.from(
    { length: 21 * 21 },
    (_, index) => (index % 21) * 0.02 + Math.floor(index / 21) * 0.01,
  ),
};

function geographicRoad(id: number, points: [x: number, y: number][]): MappedRoad {
  // Places points in source-frame units by inverting the projection numerically along each axis.
  const center = projectToRealTerrainFrame(placement, 53, -6.4, sourceFrame);
  const east = projectToRealTerrainFrame(placement, 53, -6.39, sourceFrame);
  const south = projectToRealTerrainFrame(placement, 52.99, -6.4, sourceFrame);

  return {
    id,
    roadClass: 'secondary',
    points: points.map(([x, y]) => ({
      latitude: 53 - ((y - center.y) / (south.y - center.y)) * 0.01,
      longitude: -6.4 + ((x - center.x) / (east.x - center.x)) * 0.01,
    })),
  };
}

void test('roads leaving and re-entering a crop become separate runs', () => {
  const crop = { x: 25, y: 25, width: 50, height: 50, rotationRadians: 0 };
  const road = geographicRoad(1, [
    [30, 50],
    [60, 50],
    [90, 50],
    [90, 60],
    [60, 60],
    [40, 60],
  ]);
  const paths = clipRoadsToCrop([road], placement, sourceFrame, crop, {
    shape: 'rectangle',
    width: 50,
    height: 50,
  });

  assert.equal(paths.length, 2);

  for (const point of paths.flatMap((path) => path.points)) {
    assert.ok(point.x >= -1e-9 && point.x <= 50 + 1e-9 && point.y >= 0 && point.y <= 50);
  }

  assert.ok(Math.abs(paths[0].points[0].x - 5) < 1e-6, 'starts at its own projected point');
  assert.ok(Math.abs((paths[0].points.at(-1)?.x ?? 0) - 50) < 1e-6, 'ends on the crop edge');
});

void test('separate roads never share a ribbon across the gap between them', () => {
  const paths: RoadPath[] = [
    {
      roadClass: 'secondary',
      points: [
        { x: 10, y: 10 },
        { x: 20, y: 10 },
      ],
    },
    {
      roadClass: 'secondary',
      points: [
        { x: 60, y: 60 },
        { x: 70, y: 60 },
      ],
    },
  ];
  const buffers = createRoadRibbonBuffers(
    paths,
    field,
    100,
    100,
    { detail: 'all', widthMm: 1 },
    1,
    square,
  );
  const firstRoadVertices = 6;

  for (let index = 0; index < buffers.indices.length; index += 3) {
    const triangle = [...buffers.indices.slice(index, index + 3)];

    assert.ok(
      triangle.every((vertex) => vertex < firstRoadVertices) ||
        triangle.every((vertex) => vertex >= firstRoadVertices),
    );
  }
});

void test('ribbon edges follow the terrain height at their own position and face upward', () => {
  const paths: RoadPath[] = [
    {
      roadClass: 'secondary',
      points: [
        { x: 10, y: 40 },
        { x: 30, y: 20 },
        { x: 70, y: 30 },
      ],
    },
  ];
  const { positions, indices } = createRoadRibbonBuffers(
    paths,
    field,
    100,
    100,
    { detail: 'all', widthMm: 4 },
    1,
    square,
  );
  const scale = 2 / 100;

  for (let offset = 0; offset < positions.length; offset += 3) {
    const x = positions[offset] / scale + 50;
    const y = positions[offset + 2] / scale + 50;

    assert.ok(
      Math.abs(positions[offset + 1] - sampleHeightField(field, x, y) * terrain3dElevationScale) <
        1e-6,
    );
  }

  for (let index = 0; index < indices.length; index += 3) {
    const [a, b, c] = [...indices.slice(index, index + 3)].map((vertex) => [
      positions[vertex * 3],
      positions[vertex * 3 + 1],
      positions[vertex * 3 + 2],
    ]);
    const normalY = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);

    assert.ok(normalY > 0, `triangle ${index / 3} faces down`);
  }
});

void test('ribbon width follows the model millimetres and the road class', () => {
  const widthAt = (roadClass: RoadPath['roadClass'], widthMm: number) => {
    const { positions } = createRoadRibbonBuffers(
      [
        {
          roadClass,
          points: [
            { x: 20, y: 50 },
            { x: 80, y: 50 },
          ],
        },
      ],
      field,
      100,
      100,
      { detail: 'tracks', widthMm },
      2,
      square,
    );

    return Math.abs(positions[5] - positions[2]) / (2 / 100);
  };

  assert.ok(Math.abs(widthAt('secondary', 1) - 2) < 1e-6);
  assert.ok(Math.abs(widthAt('secondary', 2) - 4) < 1e-6);
  assert.ok(widthAt('motorway', 1) > widthAt('residential', 1));
});

void test('detail filters classes without needing a refetch', () => {
  const paths: RoadPath[] = [
    {
      roadClass: 'primary',
      points: [
        { x: 10, y: 10 },
        { x: 20, y: 10 },
      ],
    },
    {
      roadClass: 'track',
      points: [
        { x: 10, y: 30 },
        { x: 20, y: 30 },
      ],
    },
  ];
  const count = (detail: 'major' | 'tracks') =>
    createRoadRibbonBuffers(paths, field, 100, 100, { detail, widthMm: 1 }, 1, square).indices
      .length;

  assert.ok(count('tracks') > count('major'));
  assert.ok(count('major') > 0);
});

void test('circular crops clip roads and keep ribbon edges on the disc', () => {
  const road = geographicRoad(1, [
    [0, 50],
    [100, 50],
  ]);
  const paths = clipRoadsToCrop(
    [road],
    placement,
    sourceFrame,
    { x: 0, y: 0, width: 100, height: 100, rotationRadians: 0 },
    circle,
  );
  const { positions } = createRoadRibbonBuffers(
    paths,
    field,
    100,
    100,
    { detail: 'all', widthMm: 6 },
    1,
    circle,
  );

  assert.equal(paths.length, 1);

  for (let offset = 0; offset < positions.length; offset += 3) {
    assert.ok(Math.hypot(positions[offset], positions[offset + 2]) <= 1 + 1e-6);
  }
});

void test('suggested road width is 0.1 mm per model kilometre within the slider range', () => {
  assert.equal(getSuggestedRoadWidthMm(5.09), 0.5);
  assert.equal(getSuggestedRoadWidthMm(12), 1.2);
  assert.equal(getSuggestedRoadWidthMm(25), 2.5);
  assert.equal(getSuggestedRoadWidthMm(0.4), 0.1);
  assert.equal(getSuggestedRoadWidthMm(100), 3);
});

void test('a right-angle bend keeps the full ribbon width on both legs', () => {
  const { positions } = createRoadRibbonBuffers(
    [
      {
        roadClass: 'secondary',
        points: [
          { x: 20, y: 50 },
          { x: 50, y: 50 },
          { x: 50, y: 80 },
        ],
      },
    ],
    { ...field, spacing: 100 },
    100,
    100,
    { detail: 'all', widthMm: 4 },
    1,
    square,
  );
  const scale = 2 / 100;
  const vertex = (index: number) => ({
    x: positions[index * 3] / scale + 50,
    y: positions[index * 3 + 2] / scale + 50,
  });
  const [left, right] = [vertex(2), vertex(3)];

  // Across each leg the corner's two edges sit a full width apart, so the bend never pinches.
  assert.ok(Math.abs(Math.abs(left.y - right.y) - 4) < 1e-6, 'incoming leg');
  assert.ok(Math.abs(Math.abs(left.x - right.x) - 4) < 1e-6, 'outgoing leg');
});
