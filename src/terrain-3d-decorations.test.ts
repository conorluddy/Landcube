import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createTerrainDecorations, type DecorationTerrain } from './terrain-3d-decorations';
import { defaultGrassStyle } from './constants/grass';
import { defaultRockStyle } from './constants/rocks';
import { defaultRoadStyle } from './constants/roads';
import { defaultTerrainModelSettings } from './terrain-model';

const terrain: DecorationTerrain = {
  field: {
    columns: 41,
    rows: 41,
    originX: 0,
    originY: 0,
    spacing: 5,
    values: new Float64Array(41 * 41),
  },
  width: 200,
  height: 200,
  seaLevel: undefined,
  roadPaths: [],
  geography: { originX: 0, originY: 0, metersPerFieldUnit: 1000, metersPerFrameUnit: 10 },
  exaggeration: 0.3,
  elevationOffset: 0,
};
const surface = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);

/** Growth summed over the grass mask. */
function totalGrowth(decorations: ReturnType<typeof createTerrainDecorations>): number {
  const data = decorations.grass.getCoverage()?.data ?? new Uint8Array();
  let total = 0;

  for (let offset = 0; offset < data.length; offset += 4) {
    total += data[offset];
  }

  return total;
}

void test('grass leaves bare ground under visible rocks, and regrows when rocks go', () => {
  const decorations = createTerrainDecorations();

  const update = () => {
    decorations.update(terrain, defaultTerrainModelSettings, defaultRoadStyle, surface);
  };

  decorations.grass.setStyle({ ...defaultGrassStyle, enabled: true, coverage: 1 });
  update();
  const meadow = totalGrowth(decorations);

  decorations.rocks.setStyle({ ...defaultRockStyle, enabled: true, rocksPerSquareCm: 30 });
  update();
  const rocky = totalGrowth(decorations);

  assert.ok(rocky < meadow, `${rocky} growth with rocks vs ${meadow} without`);
  decorations.rocks.setStyle({ ...defaultRockStyle, enabled: false });
  update();
  assert.equal(totalGrowth(decorations), meadow);
});
