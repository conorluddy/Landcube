import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encodeTerrainStill, getStillPixelRatio, maximumStillPixels } from './still-export';

function createFakeFrame({
  hasContext = true,
  encodes = true,
}: { hasContext?: boolean; encodes?: boolean } = {}) {
  const drawnText: { text: string; x: number; y: number }[] = [];
  const context = {
    font: '',
    fillText: (text: string, x: number, y: number) => drawnText.push({ text, x, y }),
  };
  const frame = {
    width: 1600,
    height: 1400,
    getContext: () => (hasContext ? context : null),
    toBlob: (callback: (blob: Blob | null) => void, type: string) => {
      callback(encodes ? new Blob(['png'], { type }) : null);
    },
  };

  return { frame: frame as unknown as HTMLCanvasElement, drawnText, context };
}

void test('real-terrain stills are stamped with attribution in the bottom-left corner', async () => {
  const { frame, drawnText, context } = createFakeFrame();
  const blob = await encodeTerrainStill(frame, 'Copernicus DEM');

  assert.equal(blob.type, 'image/png');
  assert.equal(drawnText.length, 1);
  assert.equal(drawnText[0].text, 'Copernicus DEM');
  assert.ok(drawnText[0].x < 50);
  assert.ok(drawnText[0].y > 1350);
  assert.equal(context.font, '20px sans-serif');
});

void test('each credit gets its own line, the last on the bottom', async () => {
  const { frame, drawnText } = createFakeFrame();

  await encodeTerrainStill(frame, ['Copernicus DEM', 'Roads © OpenStreetMap contributors']);
  assert.deepEqual(
    drawnText.map((line) => line.text),
    ['Copernicus DEM', 'Roads © OpenStreetMap contributors'],
  );
  assert.ok(drawnText[0].y < drawnText[1].y);
  assert.equal(drawnText[0].x, drawnText[1].x);
});

void test('generated-terrain stills are encoded without attribution', async () => {
  const { frame, drawnText } = createFakeFrame();

  await encodeTerrainStill(frame, undefined);
  assert.equal(drawnText.length, 0);
});

void test('attribution failures and encoding failures surface actionable errors', async () => {
  await assert.rejects(
    encodeTerrainStill(createFakeFrame({ hasContext: false }).frame, 'Copernicus DEM'),
    /could not be annotated/,
  );
  await assert.rejects(
    encodeTerrainStill(createFakeFrame({ encodes: false }).frame, undefined),
    /Try a smaller scale/,
  );
});

void test('stills render at the requested scale when the viewport fits the limits', () => {
  assert.equal(getStillPixelRatio(4, 1280, 800, 16384), 4);
});

void test('large viewports are scaled down to stay within the pixel cap', () => {
  const ratio = getStillPixelRatio(4, 2560, 1440, 16384);

  assert.ok(ratio < 4 && ratio > 3.2);
  assert.ok(2560 * ratio * 1440 * ratio <= maximumStillPixels + 1);
});

void test('the GPU texture limit caps the longest side', () => {
  assert.equal(getStillPixelRatio(4, 2000, 500, 4096), 4096 / 2000);
});
