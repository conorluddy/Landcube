import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRealTerrain, type TerrainTileLoader } from './real-terrain';
import {
  getMercatorX,
  getMercatorY,
  getRealTerrainSourceBounds,
  locateRealTerrainFramePoint,
  projectToRealTerrainFrame,
} from './real-terrain-projection';

const placement = { location: { latitude: 53.03, longitude: -6.4 }, spanKm: 25 };
const frame = { width: 1200, height: 800 };

/** Tiles whose elevation is the global pixel index along one axis, offset to fit Terrarium. */
function createAxisTileLoader(axis: 'x' | 'y'): { loader: TerrainTileLoader; zoom: () => number } {
  let zoom = 0;

  const loader: TerrainTileLoader = (url) => {
    const [z, x, y] = /(\d+)\/(\d+)\/(\d+)\.png$/.exec(url)?.slice(1).map(Number) ?? [];
    const center =
      axis === 'x'
        ? getMercatorX(placement.location.longitude)
        : getMercatorY(placement.location.latitude);
    const base = Math.floor(center * 2 ** z * 256) - 2000;
    const pixels = new Uint8Array(256 * 256 * 4);

    zoom = z;

    for (let row = 0; row < 256; row++) {
      for (let column = 0; column < 256; column++) {
        const elevation = (axis === 'x' ? x * 256 + column : y * 256 + row) - base + 32768;
        const offset = (row * 256 + column) * 4;

        pixels.set([Math.floor(elevation / 256), elevation % 256, 0, 255], offset);
      }
    }

    return Promise.resolve({ pixels, imagerySources: '' });
  };

  return { loader, zoom: () => zoom };
}

for (const axis of ['x', 'y'] as const) {
  void test(`projected ${axis} positions land where terrain samples the same place`, async () => {
    const { loader, zoom } = createAxisTileLoader(axis);
    const terrain = await loadRealTerrain(
      placement.location.latitude,
      placement.location.longitude,
      placement.spanKm,
      loader,
    );
    const elevations = terrain.elevations;

    assert.ok(elevations);

    for (const [latitude, longitude] of [
      [53.03, -6.4],
      [53.1, -6.5],
      [52.96, -6.31],
    ]) {
      const point = projectToRealTerrainFrame(placement, latitude, longitude, frame);
      const sampled =
        terrain.sample(point.x, point.y, frame.width, frame.height) * elevations.metersPerUnit +
        elevations.originMeters;
      const scale = 2 ** zoom() * 256;
      const expected =
        axis === 'x'
          ? getMercatorX(longitude) * scale - (Math.floor(getMercatorX(-6.4) * scale) - 2000)
          : getMercatorY(latitude) * scale - (Math.floor(getMercatorY(53.03) * scale) - 2000);

      assert.ok(Math.abs(sampled - expected) < 1e-6, `${sampled} ≠ ${expected}`);
    }
  });
}

void test('source bounds are the square patch the terrain frame spans', () => {
  const square = { width: 1000, height: 1000 };
  const bounds = getRealTerrainSourceBounds(placement);
  const northWest = projectToRealTerrainFrame(placement, bounds.north, bounds.west, square);
  const southEast = projectToRealTerrainFrame(placement, bounds.south, bounds.east, square);

  assert.ok(Math.hypot(northWest.x, northWest.y) < 1e-6);
  assert.ok(Math.hypot(southEast.x - 1000, southEast.y - 1000) < 1e-6);
  assert.ok(
    bounds.north > placement.location.latitude && bounds.west < placement.location.longitude,
  );
});

void test('points across the antimeridian stay beside a date-line source', () => {
  const pacific = { location: { latitude: -17, longitude: 179.95 }, spanKm: 25 };
  const east = projectToRealTerrainFrame(pacific, -17, -179.95, frame);

  assert.ok(east.x > frame.width / 2 && east.x < frame.width, `x was ${east.x}`);
});

void test('locating a frame point inverts the projection, so the HUD reads the sampled place', () => {
  const point = projectToRealTerrainFrame(placement, 53.07, -6.33, frame);
  const located = locateRealTerrainFramePoint(placement, point, frame);

  assert.ok(Math.abs(located.latitude - 53.07) < 1e-9);
  assert.ok(Math.abs(located.longitude - -6.33) < 1e-9);
});

void test('the frame centre locates to the source location', () => {
  const located = locateRealTerrainFramePoint(
    placement,
    { x: frame.width / 2, y: frame.height / 2 },
    frame,
  );

  assert.ok(Math.abs(located.latitude - placement.location.latitude) < 1e-9);
  assert.ok(Math.abs(located.longitude - placement.location.longitude) < 1e-9);
});
