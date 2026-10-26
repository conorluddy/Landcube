import { formatDecimalPair, formatDms, formatModelSpan, type FloorPlace } from './floor-geo';
import { inkAlpha, mono, paintTextOnBottomArc, sans, type FloorPen } from './terrain-floor-pen';

// Floor styles that frame the model with marks and set its name around it.
// Geometry is in mock px (see terrain-floor-pen.ts) so numbers match the design handoff 1:1.

// === PUBLIC API ===

/** The quietest style: a north needle, then the name set large along the south edge. */
export function paintPlinthLabels(pen: FloorPen, place: FloorPlace): void {
  const { context, halfWidth, halfLength } = pen;

  pen.fill(inkAlpha.text);
  pen.font(14, sans, 500);
  pen.text('N', 0, -halfLength - 104, 'center', 'top');
  pen.stroke(inkAlpha.text, 1);
  pen.line(0, -halfLength - 82, 0, -halfLength - 16);
  pen.stroke(inkAlpha.rule, 1);
  pen.line(-halfWidth, halfLength + 24, halfWidth, halfLength + 24);

  const coordinates = `${formatDms(place.latitude, 'lat')}    ${formatDms(place.longitude, 'lon')}`;
  const title = (place.name ?? coordinates).toUpperCase();
  const detail =
    place.name === undefined
      ? formatModelSpan(place)
      : [coordinates, place.region?.toUpperCase() ?? ''].filter((part) => part !== '').join('    ');
  let titleSize = 40;

  pen.font(titleSize, sans, 600, 0.3);

  while (context.measureText(title).width > pen.toCanvas(halfWidth * 2 * 1.9) && titleSize > 18) {
    titleSize -= 2;
    pen.font(titleSize, sans, 600, 0.3);
  }

  pen.text(title, 0, halfLength + 38, 'center', 'top');
  pen.font(12, mono, 400, 0.06);
  pen.text(detail, 0, halfLength + 38 + titleSize + 18, 'center', 'top');
}

export function paintRoseRhumbLines(pen: FloorPen): void {
  const inner = getRoseRadius(pen) - 16;

  pen.stroke(inkAlpha.rhumb, 1);

  for (let index = 0; index < 16; index++) {
    const [x, y] = toBearingPoint(index * 22.5, inner);

    pen.line(0, 0, x, y);
  }
}

/** Bearing ring with degree ticks and cardinals; the place runs along the bottom arc. */
export function paintRoseLabels(pen: FloorPen, place: FloorPlace): void {
  const { context } = pen;
  const radius = getRoseRadius(pen);
  const inner = radius - 16;

  pen.stroke(inkAlpha.text, 1.5);
  pen.circle(radius);
  pen.stroke(inkAlpha.rule, 0.75);
  pen.circle(inner);

  for (let bearing = 0; bearing < 360; bearing += 5) {
    const length = bearing % 30 === 0 ? 16 : bearing % 10 === 0 ? 10 : 6;

    pen.stroke(inkAlpha.text, bearing % 30 === 0 ? 1.5 : 0.75);
    pen.line(...toBearingPoint(bearing, inner), ...toBearingPoint(bearing, inner - length));
  }

  pen.fill(inkAlpha.text);
  pen.font(10, mono);

  for (const bearing of [30, 60, 120, 150, 210, 240, 300, 330]) {
    pen.text(
      String(bearing).padStart(3, '0'),
      ...toBearingPoint(bearing, radius + 12),
      'center',
      'middle',
    );
  }

  pen.font(18, sans, 600);

  for (const [index, cardinal] of ['N', 'E', 'S', 'W'].entries()) {
    pen.text(cardinal, ...toBearingPoint(index * 90, radius + 38), 'center', 'middle');
  }

  context.beginPath();
  context.moveTo(0, pen.toCanvas(-radius));
  context.lineTo(pen.toCanvas(12), pen.toCanvas(-radius + 32));
  context.lineTo(0, pen.toCanvas(-radius + 24));
  context.lineTo(pen.toCanvas(-12), pen.toCanvas(-radius + 32));
  context.closePath();
  context.fill();

  const arcText = [place.name?.toUpperCase(), formatDecimalPair(place), formatModelSpan(place)]
    .filter((part) => part !== undefined)
    .join(' · ');

  pen.font(13, sans, 600, 0.23);
  paintTextOnBottomArc(context, arcText, pen.toCanvas(radius - 42));
}

/** Print registration corners carrying exact DMS bounds, with the name up the west edge. */
export function paintCropMarkLabels(pen: FloorPen, place: FloorPlace): void {
  const { context, halfWidth, halfLength } = pen;
  const { bounds } = place;
  const corner = { x: halfWidth + 14, y: halfLength + 14 };
  const arm = 22;

  pen.stroke(inkAlpha.text, 1.5);

  for (const [signX, signY] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    const x = signX * corner.x;
    const y = signY * corner.y;

    pen.line(x, y, x - signX * arm, y);
    pen.line(x, y, x, y - signY * arm);
  }

  pen.fill(inkAlpha.text);
  pen.font(10, mono);

  const paintCorner = (
    latitude: number,
    longitude: number,
    x: number,
    y: number,
    align: CanvasTextAlign,
  ) => {
    pen.text(formatDms(latitude, 'lat'), x, y, align, 'top');
    pen.text(formatDms(longitude, 'lon'), x, y + 14, align, 'top');
  };

  paintCorner(bounds.north, bounds.west, -corner.x, -halfLength - 70, 'left');
  paintCorner(bounds.north, bounds.east, corner.x, -halfLength - 70, 'right');
  paintCorner(bounds.south, bounds.west, -corner.x, halfLength + 42, 'left');
  paintCorner(bounds.south, bounds.east, corner.x, halfLength + 42, 'right');

  pen.font(12, sans, 600);
  pen.text('N', 0, -halfLength - 82, 'center', 'top');
  pen.stroke(inkAlpha.text, 1);
  pen.line(0, -halfLength - 62, 0, -halfLength - 22);

  context.save();
  context.translate(pen.toCanvas(-halfWidth - 58), pen.toCanvas(halfLength));
  context.rotate(-Math.PI / 2);
  pen.font(11, sans, 600, 0.24);
  pen.text((place.name ?? formatDecimalPair(place)).toUpperCase(), 0, 0, 'left', 'middle');

  if (place.region !== undefined) {
    pen.font(11, sans, 400, 0.24);
    pen.text(place.region.toUpperCase(), halfLength * 2, 0, 'right', 'middle');
  }

  context.restore();
}

// === HELPERS ===

/** The ring clears the model's corners: 330 mock px for a square model. */
function getRoseRadius(pen: FloorPen): number {
  return Math.max(330, Math.hypot(pen.halfWidth, pen.halfLength) + 75);
}

function toBearingPoint(bearingDegrees: number, radius: number): [number, number] {
  const angle = ((bearingDegrees - 90) * Math.PI) / 180;

  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}
