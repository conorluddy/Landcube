import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFloorPlace, formatDecimal, formatDms, type FloorPlace } from './floor-geo';
import { createFloorPen, type FloorFrame } from './terrain-floor-pen';
import {
  floorStyles,
  paintFloorStyleLabels,
  paintFloorStyleLines,
  type FloorStyle,
} from './terrain-floor-styles';

const sourceFrame = { width: 30, height: 20 };
const squareCrop = { x: 5, y: 0, width: 20, height: 20 };
const nonSquareCrop = { x: 20, y: 2, width: 8, height: 4 };
const aso = { location: { latitude: 32.8842, longitude: 131.104 }, spanKm: 30 };
const custom = { location: { latitude: 10, longitude: 20 }, spanKm: 30 };
const cartographicStyles = (Object.keys(floorStyles) as FloorStyle[]).filter(
  (style): style is Exclude<FloorStyle, 'grid'> => style !== 'grid',
);

void test('every cartographic style draws finite lines and labels around a named model', () => {
  for (const style of cartographicStyles) {
    const { calls, texts } = paintFloor(style, getPlace(aso, squareCrop), squareCrop);

    assert.ok(texts.includes('MOUNT ASO'), `${style} prints the preset name`);
    assert.ok(
      calls.some((call) => call.method === 'stroke' || call.method === 'strokeRect'),
      `${style} draws lines`,
    );
    assertFiniteArguments(style, calls);
  }
});

void test('custom locations print coordinates in place of a name, on square and non-square crops', () => {
  for (const crop of [squareCrop, nonSquareCrop]) {
    const place = getPlace(custom, crop);
    const coordinates = [formatDms(place.latitude, 'lat'), formatDecimal(place.latitude, 'lat')];

    for (const style of cartographicStyles) {
      const { calls, texts } = paintFloor(style, place, crop);

      assert.ok(
        coordinates.some((coordinate) => texts.includes(coordinate)),
        `${style} prints coordinates`,
      );
      assert.ok(!texts.includes('undefined'), `${style} never prints "undefined"`);
      assertFiniteArguments(style, calls);
    }
  }
});

void test('each cartographic style paints a different floor', () => {
  const place = getPlace(aso, nonSquareCrop);
  const drawings = cartographicStyles.map((style) =>
    JSON.stringify(paintFloor(style, place, nonSquareCrop).calls),
  );

  assert.equal(new Set(drawings).size, cartographicStyles.length);
});

void test('centered tracked text is shifted only when the canvas supports letter spacing', () => {
  for (const hasLetterSpacing of [true, false]) {
    const recording = createRecordingContext(hasLetterSpacing);
    const pen = createFloorPen({ ...getFrame(squareCrop), context: recording.context });

    pen.font(10, 'serif', 400, 0.5);
    pen.text('N', 0, 0, 'center');
    const [x] = recording.calls.find((call) => call.method === 'fillText')?.args.slice(1) ?? [];

    assert.equal(x === 0, !hasLetterSpacing);
  }
});

// === HELPERS ===

interface RecordedCall {
  method: string;
  args: unknown[];
}

function getPlace(source: typeof aso, crop: typeof squareCrop): FloorPlace {
  const place = createFloorPlace(source, crop, sourceFrame);

  assert.ok(place);

  return place;
}

/** Mirrors terrain-map-grid.ts: the floor plane is 2.8× the model's longer side on a 2048 px canvas. */
function getFrame(crop: typeof squareCrop): Omit<FloorFrame, 'context'> {
  const pixelsPerUnit = 2048 / (Math.max(crop.width, crop.height) * 2.8);

  return {
    extentPx: Math.max(crop.width, crop.height) * pixelsPerUnit,
    halfWidthPx: (crop.width * pixelsPerUnit) / 2,
    halfLengthPx: (crop.height * pixelsPerUnit) / 2,
    ink: '20, 20, 20',
  };
}

function paintFloor(
  style: Exclude<FloorStyle, 'grid'>,
  place: FloorPlace,
  crop: typeof squareCrop,
): { calls: RecordedCall[]; texts: string } {
  const { context, calls } = createRecordingContext(true);
  const frame = { ...getFrame(crop), context };

  paintFloorStyleLines(style, frame, place);
  paintFloorStyleLabels(style, frame, place, 20);

  const texts = calls
    .filter((call) => call.method === 'fillText')
    .map((call) => String(call.args[0]))
    .join('');

  return { calls, texts };
}

/** A 2D context stand-in that records every call; text measures 6 px per character. */
function createRecordingContext(hasLetterSpacing: boolean): {
  context: CanvasRenderingContext2D;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const state: Record<string | symbol, unknown> = hasLetterSpacing ? { letterSpacing: '0px' } : {};
  const context = new Proxy(state, {
    get(target, property) {
      if (property in target) {
        return target[property];
      }

      if (property === 'measureText') {
        return (value: string) => ({ width: value.length * 6 });
      }

      return (...args: unknown[]) => {
        calls.push({ method: String(property), args });
      };
    },
    set(target, property, value) {
      target[property] = value;

      return true;
    },
  });

  return { context: context as unknown as CanvasRenderingContext2D, calls };
}

function assertFiniteArguments(style: FloorStyle, calls: RecordedCall[]): void {
  for (const { method, args } of calls) {
    for (const value of args) {
      assert.ok(
        typeof value !== 'number' || Number.isFinite(value),
        `${style} passed ${String(value)} to ${method}`,
      );
    }
  }
}
