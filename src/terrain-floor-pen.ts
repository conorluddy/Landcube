/** Floor-canvas drawing primitives in the design handoff's "mock px": a 360 px model, edges at ±180. */

/** The floor canvas, already translated to the model center: +x east, +y south. */
export interface FloorFrame {
  context: CanvasRenderingContext2D;
  extentPx: number;
  halfWidthPx: number;
  halfLengthPx: number;
  ink: string;
}

/** Takes mock px and writes canvas px in the floor ink. */
export interface FloorPen {
  context: CanvasRenderingContext2D;
  toCanvas: (mockPx: number) => number;
  halfWidth: number;
  halfLength: number;
  stroke: (alpha: number, widthMockPx: number) => void;
  fill: (alpha: number) => void;
  font: (sizeMockPx: number, family: string, weight?: number, trackingEm?: number) => void;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  strokeRect: (x: number, y: number, width: number, height: number) => void;
  measure: (value: string) => number;
  circle: (radius: number) => void;
  text: (
    value: string,
    x: number,
    y: number,
    align?: CanvasTextAlign,
    baseline?: CanvasTextBaseline,
  ) => void;
}

const mockModelSizePx = 360;

export const mono = 'ui-monospace, Menlo, monospace';
export const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
/** Ink opacities keep the floor quieter than the model. */
export const inkAlpha = { text: 0.85, line: 0.7, rule: 0.6, dashed: 0.45, rhumb: 0.22 };

export function createFloorPen(frame: FloorFrame): FloorPen {
  const { context, extentPx, ink } = frame;
  const toCanvas = (mockPx: number) => (mockPx * extentPx) / mockModelSizePx;
  let trackingPx = 0;

  return {
    context,
    toCanvas,
    halfWidth: (frame.halfWidthPx * mockModelSizePx) / extentPx,
    halfLength: (frame.halfLengthPx * mockModelSizePx) / extentPx,
    stroke(alpha, widthMockPx) {
      context.strokeStyle = `rgba(${ink}, ${alpha})`;
      context.lineWidth = toCanvas(widthMockPx);
    },
    fill(alpha) {
      context.fillStyle = `rgba(${ink}, ${alpha})`;
    },
    font(sizeMockPx, family, weight = 400, trackingEm = 0) {
      trackingPx = toCanvas(sizeMockPx) * trackingEm;
      context.font = `${weight} ${toCanvas(sizeMockPx)}px ${family}`;
      context.letterSpacing = `${trackingPx}px`;
    },
    line(x1, y1, x2, y2) {
      context.beginPath();
      context.moveTo(toCanvas(x1), toCanvas(y1));
      context.lineTo(toCanvas(x2), toCanvas(y2));
      context.stroke();
    },
    strokeRect(x, y, width, height) {
      context.strokeRect(toCanvas(x), toCanvas(y), toCanvas(width), toCanvas(height));
    },
    measure(value) {
      return (context.measureText(value).width * mockModelSizePx) / extentPx;
    },
    circle(radius) {
      context.beginPath();
      context.arc(0, 0, toCanvas(radius), 0, Math.PI * 2);
      context.stroke();
    },
    text(value, x, y, align = 'left', baseline = 'alphabetic') {
      // Canvas tracking trails the last glyph; shift so centered and right-aligned text stays optically placed.
      const trailing = align === 'center' ? trackingPx / 2 : align === 'right' ? trackingPx : 0;

      context.textAlign = align;
      context.textBaseline = baseline;
      context.fillText(value, toCanvas(x) + trailing, toCanvas(y));
    },
  };
}

/** Alternating checkered bar with distance labels under the given ticks. */
export function paintScaleBar(
  pen: FloorPen,
  x: number,
  y: number,
  width: number,
  height: number,
  ticksKm: number[],
  segments: number,
  labelBaseline: number,
): void {
  const totalKm = ticksKm[ticksKm.length - 1];
  const inMeters = totalKm < 1;
  const formatTick = (km: number) => String(Number((inMeters ? km * 1000 : km).toPrecision(3)));

  pen.stroke(inkAlpha.text, 1);
  pen.strokeRect(x, y, width, height);
  pen.fill(inkAlpha.text);

  for (let index = 0; index < segments; index += 2) {
    pen.context.fillRect(
      pen.toCanvas(x + (index * width) / segments),
      pen.toCanvas(y),
      pen.toCanvas(width / segments),
      pen.toCanvas(height),
    );
  }

  pen.font(10, mono);

  for (const [index, km] of ticksKm.entries()) {
    const isLast = index === ticksKm.length - 1;
    const tickX = x + (km / totalKm) * width;

    pen.text(formatTick(km), tickX, labelBaseline, 'center');

    if (isLast) {
      pen.text(inMeters ? ' m' : ' km', tickX + pen.measure(formatTick(km)) / 2, labelBaseline);
    }
  }
}

/** Upright text centered on the bottom of a circle, reading west to east. */
export function paintTextOnBottomArc(
  context: CanvasRenderingContext2D,
  value: string,
  radius: number,
): void {
  const characters = Array.from(new Intl.Segmenter().segment(value), ({ segment }) => segment);
  // Widths include tracking, so each glyph is centered within its own slot.
  const widths = characters.map((character) => context.measureText(character).width);
  let angle = Math.PI / 2 + widths.reduce((total, width) => total + width, 0) / radius / 2;

  context.letterSpacing = '0px';
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  for (const [index, character] of characters.entries()) {
    const halfAngle = widths[index] / radius / 2;

    angle -= halfAngle;
    context.save();
    context.translate(Math.cos(angle) * radius, Math.sin(angle) * radius);
    context.rotate(angle - Math.PI / 2);
    context.fillText(character, 0, 0);
    context.restore();
    angle -= halfAngle;
  }
}
