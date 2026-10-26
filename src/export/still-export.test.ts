import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encodeTerrainStill } from './still-export';

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
