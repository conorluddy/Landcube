import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createTerrainModel,
  getFrameUnitsPerMm,
  cropTerrainModelField,
  defaultTerrainModelSettings,
  getSuggestedExaggeration,
  validateTerrainModelSettings,
} from './terrain-model';
import { createBinaryStl, validatePrintableSolid } from './export/stl-export';
import type { HeightField } from './types/terrain';

void test('suggested height lifts flat wide places and calms steep crops', () => {
  const ibiza = getSuggestedExaggeration(525, 55);
  const everest = getSuggestedExaggeration(4000, 25);

  assert.ok(ibiza < everest);
  assert.ok(ibiza >= 0.05 && everest <= 0.6);
  assert.equal(getSuggestedExaggeration(0, 25), 0.3);
});

const field: HeightField = {
  columns: 5,
  rows: 4,
  originX: -5,
  originY: -5,
  spacing: 10,
  values: Float64Array.from({ length: 20 }, (_, index) => index / 5 - 2),
};

for (const [widthMm, lengthMm] of [
  [150, 150],
  [180, 90],
  [25, 200],
  [1, 1000],
]) {
  for (const exaggeration of [0, 0.3, 1]) {
    void test(`printable ${widthMm}x${lengthMm} model at ${exaggeration} exaggeration`, () => {
      const settings = { widthMm, lengthMm, baseThicknessMm: 3 };
      const crop = cropTerrainModelField(field, 30, 20, settings);
      const model = createTerrainModel(crop.field, crop.width, crop.height, settings, exaggeration);

      validatePrintableSolid(model.solid);
      const axis = (mesh: Float32Array, component: number) =>
        Array.from(mesh).filter((_, index) => index % 3 === component);
      const xs = axis(model.solid.positions, 0);
      const ys = axis(model.solid.positions, 1);
      const zs = axis(model.solid.positions, 2);

      assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - widthMm) < 0.001);
      assert.ok(Math.abs(Math.max(...zs) - Math.min(...zs) - lengthMm) < 0.001);
      assert.equal(Math.min(...ys), 0);
      assert.equal(Math.min(...axis(model.surface.positions, 1)), 3);
      assert.ok(Math.abs(Math.max(...ys) - model.overallHeightMm) < 0.001);
      const stl = createBinaryStl(model.solid);
      const data = new DataView(stl);
      const count = model.solid.indices.length / 3;

      assert.equal(data.getUint32(80, true), count);
      assert.equal(stl.byteLength, 84 + count * 50);

      for (let triangle = 0; triangle < count; triangle++) {
        for (let vertex = 0; vertex < 3; vertex++) {
          const source = model.solid.indices[triangle * 3 + vertex] * 3;
          const offset = 84 + triangle * 50 + 12 + vertex * 12;

          assert.equal(data.getFloat32(offset, true), model.solid.positions[source]);
          assert.equal(data.getFloat32(offset + 4, true), -model.solid.positions[source + 2]);
          assert.equal(data.getFloat32(offset + 8, true), model.solid.positions[source + 1]);
        }
      }

      if (exaggeration === 0) {
        assert.equal(model.overallHeightMm, 3);
      }
    });
  }
}

void test('centered crops retain proportions and never accumulate', () => {
  const square = cropTerrainModelField(field, 30, 20, defaultTerrainModelSettings);

  assert.equal(square.x, 5);
  assert.equal(square.y, 0);
  assert.equal(square.width, 20);
  assert.equal(square.height, 20);
  assert.equal(square.field.originX, -10);
  assert.equal(square.field.values, field.values);
  cropTerrainModelField(field, 30, 20, { ...defaultTerrainModelSettings, lengthMm: 300 });
  assert.deepEqual(cropTerrainModelField(field, 30, 20, defaultTerrainModelSettings), square);
});

void test('invalid dimensions and damaged solids cannot be exported', () => {
  for (const widthMm of [0, NaN, Infinity, 1001]) {
    assert.throws(() => {
      validateTerrainModelSettings({ ...defaultTerrainModelSettings, widthMm });
    });
  }

  assert.throws(() => {
    validateTerrainModelSettings({ ...defaultTerrainModelSettings, baseThicknessMm: 0 });
  });
  const crop = cropTerrainModelField(field, 30, 20, defaultTerrainModelSettings);
  const model = createTerrainModel(
    crop.field,
    crop.width,
    crop.height,
    defaultTerrainModelSettings,
    0.3,
  );

  assert.throws(() => createBinaryStl(model.surface), /closed/);
  assert.throws(
    () => createBinaryStl({ ...model.solid, indices: model.solid.indices.slice(3) }),
    /closed/,
  );
  assert.throws(
    () =>
      createBinaryStl({ positions: model.solid.positions, indices: new Uint32Array([0, 0, 0]) }),
    /degenerate/,
  );
});

for (const size of [1, 0.65, 0.1]) {
  for (const exaggeration of [0, 0.3, 1]) {
    void test(`circular crop at ${size} size and ${exaggeration} exaggeration exports a watertight disk`, () => {
      const settings = { ...defaultTerrainModelSettings, cropShape: 'circle' as const };
      const crop = cropTerrainModelField(field, 30, 20, settings, {
        centerX: 0.75,
        centerY: 0.25,
        size,
      });

      assert.equal(crop.width, crop.height);
      const model = createTerrainModel(crop.field, crop.width, crop.height, settings, exaggeration);

      validatePrintableSolid(model.solid);
      const stl = createBinaryStl(model.solid);

      assert.equal(new DataView(stl).getUint32(80, true), model.solid.indices.length / 3);
      let minimum = Infinity;

      for (let index = 0; index < model.surface.positions.length; index += 3) {
        const [x, y, z] = model.surface.positions.subarray(index, index + 3);

        assert.ok(Math.hypot(x, z) <= 75.00001);
        minimum = Math.min(minimum, y);
      }

      assert.ok(Math.abs(minimum - 3) < 1e-5);
      assert.ok(model.overallHeightMm >= 3);
    });
  }
}

void test('moving a crop changes its terrain without stretching or accumulating selection offsets', () => {
  const settings = { ...defaultTerrainModelSettings, cropShape: 'circle' as const };
  const left = cropTerrainModelField(field, 30, 20, settings, {
    centerX: 0.25,
    centerY: 0.5,
    size: 0.5,
  });
  const right = cropTerrainModelField(field, 30, 20, settings, {
    centerX: 0.75,
    centerY: 0.5,
    size: 0.5,
  });

  assert.equal(left.width, right.width);
  assert.equal(left.field.values, field.values);
  assert.notEqual(left.field.originX, right.field.originX);
  assert.notDeepEqual(
    createTerrainModel(left.field, left.width, left.height, settings, 0.3).surface.positions,
    createTerrainModel(right.field, right.width, right.height, settings, 0.3).surface.positions,
  );
});

void test('an off-center rectangular crop reports where it sits in the source frame', () => {
  const settings = { ...defaultTerrainModelSettings, widthMm: 200, lengthMm: 100 };
  const crop = cropTerrainModelField(field, 30, 20, settings, {
    centerX: 0.75,
    centerY: 0.25,
    size: 0.5,
  });

  assert.deepEqual([crop.x, crop.y, crop.width, crop.height], [15, 1.25, 15, 7.5]);
  assert.equal(crop.field.originX, field.originX - crop.x);
  assert.equal(crop.field.originY, field.originY - crop.y);
});

void test('frame units per millimetre span the longer side, or a circle diameter, across the model', () => {
  assert.equal(getFrameUnitsPerMm(600, 300, { widthMm: 150, lengthMm: 100 }), 4);
  assert.equal(getFrameUnitsPerMm(300, 600, { widthMm: 100, lengthMm: 150 }), 4);
  assert.equal(
    getFrameUnitsPerMm(400, 400, { widthMm: 100, lengthMm: 300, cropShape: 'circle' }),
    4,
  );
});
