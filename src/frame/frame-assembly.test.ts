import assert from 'node:assert/strict';
import { test } from 'node:test';
import { frameProfilePresets } from '../constants/frame';
import { validatePrintableSolid } from '../export/stl-export';
import type { TerrainModelSettings } from '../terrain-model';
import type { FrameAssembly, TrayFrameSettings } from '../types/frame';
import type { Result } from '../types/operations';
import { createDefaultTrayFrame, createFrameAssembly } from './frame-assembly';

const rectangleModel: TerrainModelSettings = { widthMm: 150, lengthMm: 150, baseThicknessMm: 3 };
const circleModel: TerrainModelSettings = { ...rectangleModel, cropShape: 'circle' };
const overallHeightMm = 40;

function expectAssembly(result: Result<FrameAssembly>): FrameAssembly {
  if (!result.ok) {
    assert.fail(result.error.message);
  }

  return result.data;
}

function expectErrorMessage(result: Result<FrameAssembly>): string {
  if (result.ok) {
    assert.fail('Expected the frame settings to be rejected.');
  }

  return result.error.message;
}

function tray(
  model: TerrainModelSettings,
  overrides: Partial<TrayFrameSettings> = {},
): TrayFrameSettings {
  return { ...createDefaultTrayFrame(model), ...overrides };
}

for (const [outline, model] of [
  ['rectangle', rectangleModel],
  ['circle', circleModel],
] as const) {
  for (const profile of frameProfilePresets) {
    void test(`${profile} tray around a ${outline} model is a printable solid`, () => {
      const assembly = expectAssembly(
        createFrameAssembly(model, overallHeightMm, tray(model, { profile })),
      );

      assert.deepEqual(
        assembly.parts.map(({ id }) => id),
        ['frame'],
      );

      for (const part of assembly.parts) {
        validatePrintableSolid(part.solid);
        assert.equal(part.printOrientation, 'upright');
      }
    });
  }
}

void test('tray opening is the footprint plus clearance per side', () => {
  const model = { widthMm: 120, lengthMm: 80, baseThicknessMm: 3 };
  const assembly = expectAssembly(
    createFrameAssembly(model, overallHeightMm, tray(model, { clearanceMm: 0.3 })),
  );
  const { positions } = assembly.parts[0].solid;
  const openingXs = new Set<number>();
  const openingZs = new Set<number>();

  for (let offset = 0; offset < positions.length; offset += 3) {
    const [x, , z] = positions.subarray(offset, offset + 3);

    if (Math.abs(x) < 61 && Math.abs(z) < 41 && (x !== 0 || z !== 0)) {
      openingXs.add(x);
      openingZs.add(z);
    }
  }

  assert.equal(openingXs.size, 2);
  assert.equal(openingZs.size, 2);

  for (const x of openingXs) {
    assert.ok(Math.abs(Math.abs(x) - 60.3) < 1e-6, `opening x ${x}`);
  }

  for (const z of openingZs) {
    assert.ok(Math.abs(Math.abs(z) - 40.3) < 1e-6, `opening z ${z}`);
  }
});

void test('same settings build identical tray buffers', () => {
  const settings = tray(circleModel, { profile: 'cove' });
  const first = expectAssembly(createFrameAssembly(circleModel, overallHeightMm, settings));
  const second = expectAssembly(createFrameAssembly(circleModel, overallHeightMm, settings));

  assert.deepEqual(first.parts[0].solid.positions, second.parts[0].solid.positions);
  assert.deepEqual(first.parts[0].solid.indices, second.parts[0].solid.indices);
});

void test('a border that collapses the outer ring names borderWidthMm', () => {
  const message = expectErrorMessage(
    createFrameAssembly(
      rectangleModel,
      overallHeightMm,
      tray(rectangleModel, { borderWidthMm: -200 }),
    ),
  );

  assert.match(message, /borderWidthMm/);
});

void test('a clearance that collapses the opening names clearanceMm', () => {
  const message = expectErrorMessage(
    createFrameAssembly(
      rectangleModel,
      overallHeightMm,
      tray(rectangleModel, { clearanceMm: -80 }),
    ),
  );

  assert.match(message, /clearanceMm/);
});

void test('walls thinner than 1.2 mm are rejected', () => {
  for (const [profile, borderWidthMm] of [
    ['square', 1.1],
    ['chamfer', 2],
  ] as const) {
    const message = expectErrorMessage(
      createFrameAssembly(
        rectangleModel,
        overallHeightMm,
        tray(rectangleModel, { profile, borderWidthMm }),
      ),
    );

    assert.match(message, /minimum is 1\.2 mm/);
  }
});

void test('a 1.2 mm square wall is accepted', () => {
  expectAssembly(
    createFrameAssembly(
      rectangleModel,
      overallHeightMm,
      tray(rectangleModel, { borderWidthMm: 1.2 }),
    ),
  );
});

void test('tray defaults raise the rim 4 mm above the base with 0.3 mm clearance', () => {
  const settings = createDefaultTrayFrame({ ...rectangleModel, baseThicknessMm: 5 });

  assert.equal(settings.wallHeightMm, 9);
  assert.equal(settings.clearanceMm, 0.3);
});

void test('outer size covers the border and the full tray height', () => {
  const model = { widthMm: 120, lengthMm: 80, baseThicknessMm: 3 };
  const assembly = expectAssembly(createFrameAssembly(model, overallHeightMm, tray(model)));

  assert.deepEqual(assembly.outerSizeMm, { x: 140.6, y: 9, z: 100.6 });
});

void test('no frame style builds no parts', () => {
  const assembly = expectAssembly(
    createFrameAssembly(rectangleModel, overallHeightMm, { style: 'none' }),
  );

  assert.deepEqual(assembly.parts, []);
});

void test('mismatched outlines wait for mount support', () => {
  const message = expectErrorMessage(
    createFrameAssembly(circleModel, overallHeightMm, tray(circleModel, { outline: 'square' })),
  );

  assert.match(message, /use outline match/);
});

void test('square outline matches a square rectangular model', () => {
  expectAssembly(
    createFrameAssembly(
      rectangleModel,
      overallHeightMm,
      tray(rectangleModel, { outline: 'square' }),
    ),
  );
});

void test('tray rejects mounts until they are supported', () => {
  const message = expectErrorMessage(
    createFrameAssembly(
      rectangleModel,
      overallHeightMm,
      tray(rectangleModel, { mounts: [{ widthMm: 20, thicknessMm: 2 }] }),
    ),
  );

  assert.match(message, /mounts/);
});

void test('invalid model settings return an error instead of throwing', () => {
  for (const widthMm of [Number.NaN, 0]) {
    const model = { ...rectangleModel, widthMm };
    const message = expectErrorMessage(createFrameAssembly(model, overallHeightMm, tray(model)));

    assert.match(message, /width and length/);
  }
});

void test('non-finite tray settings name the setting', () => {
  const message = expectErrorMessage(
    createFrameAssembly(
      rectangleModel,
      overallHeightMm,
      tray(rectangleModel, { floorThicknessMm: Number.NaN }),
    ),
  );

  assert.match(message, /floorThicknessMm/);
});

void test('a 1.2 mm wall is accepted whatever the clearance rounding', () => {
  expectAssembly(
    createFrameAssembly(
      rectangleModel,
      overallHeightMm,
      tray(rectangleModel, { borderWidthMm: 1.2, clearanceMm: -3.98 }),
    ),
  );
});

void test('a press-fit clearance builds a printable tray', () => {
  const assembly = expectAssembly(
    createFrameAssembly(
      rectangleModel,
      overallHeightMm,
      tray(rectangleModel, { clearanceMm: -0.1 }),
    ),
  );

  validatePrintableSolid(assembly.parts[0].solid);
});

void test('a long thin model collapses on its short axis first', () => {
  const model = { widthMm: 120, lengthMm: 20, baseThicknessMm: 3 };
  const message = expectErrorMessage(
    createFrameAssembly(model, overallHeightMm, tray(model, { clearanceMm: -12 })),
  );

  assert.match(message, /clearanceMm/);
});

void test('round tray opening is the model radius plus clearance', () => {
  const assembly = expectAssembly(
    createFrameAssembly(circleModel, overallHeightMm, tray(circleModel, { clearanceMm: 0.3 })),
  );
  const { positions } = assembly.parts[0].solid;
  let openingVertexCount = 0;

  for (let offset = 0; offset < positions.length; offset += 3) {
    const radiusMm = Math.hypot(positions[offset], positions[offset + 2]);

    if (radiusMm > 1 && radiusMm < 76) {
      openingVertexCount++;
      // Float32 positions resolve about 4e-6 mm at this radius.
      assert.ok(Math.abs(radiusMm - 75.3) < 1e-5, `opening radius ${radiusMm}`);
    }
  }

  assert.equal(openingVertexCount, 512 * 2);
});

void test('circle outline matches a circular model', () => {
  expectAssembly(
    createFrameAssembly(circleModel, overallHeightMm, tray(circleModel, { outline: 'circle' })),
  );
});

void test('tray rejects a float until it is supported', () => {
  const message = expectErrorMessage(
    createFrameAssembly(
      rectangleModel,
      overallHeightMm,
      tray(rectangleModel, { float: { insetMm: 10, liftMm: 5 } }),
    ),
  );

  assert.match(message, /float/);
});

void test('an unknown profile lists the presets', () => {
  const message = expectErrorMessage(
    createFrameAssembly(
      rectangleModel,
      overallHeightMm,
      tray(rectangleModel, { profile: 'ogee' as TrayFrameSettings['profile'] }),
    ),
  );

  assert.match(message, /square, chamfer, cove, stepped, floating/);
});

void test('a floor thinner than 1.2 mm is rejected', () => {
  const message = expectErrorMessage(
    createFrameAssembly(
      rectangleModel,
      overallHeightMm,
      tray(rectangleModel, { floorThicknessMm: 0.4 }),
    ),
  );

  assert.match(message, /floorThicknessMm 0\.4/);
});
