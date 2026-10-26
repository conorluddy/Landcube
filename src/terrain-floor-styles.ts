import {
  formatDecimal,
  formatDms,
  graticuleValues,
  latitudeFraction,
  longitudeFraction,
  pickGraticuleStep,
  pickScaleDistanceKm,
  type FloorPlace,
} from './floor-geo';
import {
  createFloorPen,
  inkAlpha,
  mono,
  paintScaleBar,
  paintTextOnBottomArc,
  sans,
  type FloorFrame,
  type FloorPen,
} from './terrain-floor-pen';

export type FloorStyle = 'grid' | 'survey' | 'plinth' | 'rose' | 'graticule' | 'crop';

export const floorStyles: Record<FloorStyle, { label: string }> = {
  grid: { label: 'Grid' },
  survey: { label: 'Survey sheet' },
  plinth: { label: 'Plinth label' },
  rose: { label: 'Compass rose' },
  graticule: { label: 'Graticule' },
  crop: { label: 'Crop marks' },
};

// === PUBLIC API ===

/** Lines that run beneath the model; painted before the footprint erase and radial fade. */
export function paintFloorStyleLines(
  style: FloorStyle,
  frame: FloorFrame,
  place: FloorPlace,
): void {
  const pen = createFloorPen(frame);

  if (style === 'rose') {
    paintRoseRhumbLines(pen);
  }

  if (style === 'graticule') {
    paintGraticuleLines(pen, place);
  }
}

/** Frames and labels sit on top of the fade, outside the model footprint. */
export function paintFloorStyleLabels(
  style: Exclude<FloorStyle, 'grid'>,
  frame: FloorFrame,
  place: FloorPlace,
  contourIntervalMeters: number | undefined,
): void {
  floorLabelPainters[style](createFloorPen(frame), place, contourIntervalMeters);
}

// === PAINTERS ===
// Geometry is in mock px (see terrain-floor-pen.ts) so numbers match the design handoff 1:1.

type FloorLabelPainter = (
  pen: FloorPen,
  place: FloorPlace,
  contourIntervalMeters: number | undefined,
) => void;

const floorLabelPainters: Record<Exclude<FloorStyle, 'grid'>, FloorLabelPainter> = {
  survey: paintSurveyLabels,
  plinth: paintPlinthLabels,
  rose: paintRoseLabels,
  graticule: paintGraticuleLabels,
  crop: paintCropMarkLabels,
};

/** USGS-style double neatline with graticule ticks, scale bar, north arrow and title block. */
function paintSurveyLabels(
  pen: FloorPen,
  place: FloorPlace,
  contourIntervalMeters: number | undefined,
): void {
  const { context, halfWidth, halfLength } = pen;
  const neatline = { x: halfWidth + 28, y: halfLength + 28 };
  const outer = { x: neatline.x + 4, y: neatline.y + 4 };

  pen.stroke(inkAlpha.line, 1);
  pen.strokeRect(-neatline.x, -neatline.y, neatline.x * 2, neatline.y * 2);
  pen.stroke(inkAlpha.text, 2);
  pen.strokeRect(-outer.x, -outer.y, outer.x * 2, outer.y * 2);

  const { latitudes, longitudes } = getGraticule(place);

  pen.font(10, mono);
  pen.fill(inkAlpha.text);
  pen.stroke(inkAlpha.text, 1);

  for (const latitude of latitudes) {
    const y = toModelY(pen, place, latitude);

    pen.line(-neatline.x, y, -neatline.x + 10, y);
    pen.line(neatline.x - 10, y, neatline.x, y);
    pen.text(
      formatDms(latitude, 'lat', 'minutes').slice(0, -1),
      -neatline.x - 10,
      y,
      'right',
      'middle',
    );
  }

  for (const longitude of longitudes) {
    const x = toModelX(pen, place, longitude);

    pen.line(x, -neatline.y, x, -neatline.y + 10);
    pen.line(x, neatline.y - 10, x, neatline.y);
    pen.text(formatDms(longitude, 'lon', 'minutes').slice(0, -1), x, -neatline.y - 10, 'center');
  }

  const arrowX = outer.x + 18;
  const arrowTop = -neatline.y;

  pen.font(13, sans, 600);
  pen.text('N', arrowX, arrowTop + 10, 'center');
  context.beginPath();
  context.moveTo(pen.toCanvas(arrowX), pen.toCanvas(arrowTop + 18));
  context.lineTo(pen.toCanvas(arrowX + 6), pen.toCanvas(arrowTop + 30));
  context.lineTo(pen.toCanvas(arrowX), pen.toCanvas(arrowTop + 27));
  context.lineTo(pen.toCanvas(arrowX - 6), pen.toCanvas(arrowTop + 30));
  context.closePath();
  context.fill();
  pen.stroke(inkAlpha.text, 1.5);
  pen.line(arrowX, arrowTop + 27, arrowX, arrowTop + 46);

  const scaleKm = pickScaleDistanceKm(place.widthKm * 0.4, place.widthKm);
  const scaleWidth = (scaleKm / place.widthKm) * halfWidth * 2;
  const footerTop = outer.y + 12;

  paintScaleBar(
    pen,
    -outer.x,
    footerTop,
    scaleWidth,
    5,
    [0, scaleKm / 2, scaleKm],
    4,
    footerTop + 20,
  );

  const block = { width: 192, x: outer.x - 192, y: footerTop };
  let cursor = block.y + 10;

  pen.fill(inkAlpha.text);

  if (place.name !== undefined) {
    pen.font(15, sans, 700, 0.06);
    pen.text(place.name.toUpperCase(), block.x + 10, cursor, 'left', 'top');
    cursor += 19;

    if (place.region !== undefined) {
      pen.font(10, sans, 400, 0.04);
      pen.text(place.region.toUpperCase(), block.x + 10, cursor, 'left', 'top');
      cursor += 16;
    }

    pen.stroke(inkAlpha.text, 1);
    pen.line(block.x + 10, cursor, block.x + block.width - 10, cursor);
    cursor += 6;
  }

  const contours =
    contourIntervalMeters === undefined ? '' : ` · contours ${contourIntervalMeters} m`;

  pen.font(10, mono);
  pen.text(formatDecimalPair(place), block.x + 10, cursor, 'left', 'top');
  pen.text(`${formatModelSize(place)}${contours}`, block.x + 10, cursor + 13, 'left', 'top');
  pen.stroke(inkAlpha.text, 2);
  pen.strokeRect(block.x, block.y, block.width, cursor + 13 + 18 - block.y);
}

/** The quietest style: a north needle, then the name set large along the south edge. */
function paintPlinthLabels(pen: FloorPen, place: FloorPlace): void {
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

function paintRoseRhumbLines(pen: FloorPen): void {
  const inner = getRoseRadius(pen) - 16;

  pen.stroke(inkAlpha.rhumb, 1);

  for (let index = 0; index < 16; index++) {
    const [x, y] = toBearingPoint(index * 22.5, inner);

    pen.line(0, 0, x, y);
  }
}

/** Bearing ring with degree ticks and cardinals; the place runs along the bottom arc. */
function paintRoseLabels(pen: FloorPen, place: FloorPlace): void {
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

function paintGraticuleLines(pen: FloorPen, place: FloorPlace): void {
  const { latitudes, longitudes } = getGraticule(place);

  pen.context.setLineDash([pen.toCanvas(3), pen.toCanvas(3)]);
  pen.stroke(inkAlpha.dashed, 1);

  for (const latitude of latitudes) {
    const y = toModelY(pen, place, latitude);

    pen.line(-graticuleReach, y, graticuleReach, y);
  }

  for (const longitude of longitudes) {
    const x = toModelX(pen, place, longitude);

    pen.line(x, -graticuleReach, x, graticuleReach);
  }

  pen.context.setLineDash([]);
}

/** Edge labels for the dashed lat/lon lines, a name row and a full-width checkered scale bar. */
function paintGraticuleLabels(
  pen: FloorPen,
  place: FloorPlace,
  contourIntervalMeters: number | undefined,
): void {
  const { context, halfWidth, halfLength } = pen;
  const { latitudes, longitudes } = getGraticule(place);

  pen.fill(inkAlpha.text);
  pen.font(11, mono);

  for (const latitude of latitudes) {
    pen.text(formatDms(latitude, 'lat', 'minutes'), -332, toModelY(pen, place, latitude) - 4);
  }

  for (const longitude of longitudes) {
    context.save();
    context.translate(pen.toCanvas(toModelX(pen, place, longitude) + 4), pen.toCanvas(-320));
    context.rotate(Math.PI / 2);
    pen.text(formatDms(longitude, 'lon', 'minutes'), 0, 0, 'left', 'bottom');
    context.restore();
  }

  pen.font(13, sans, 600);
  pen.text('N', toModelX(pen, place, place.longitude), -352, 'center', 'top');
  pen.font(12, sans, 600, 0.12);
  pen.text((place.name ?? formatDecimalPair(place)).toUpperCase(), -halfWidth, -halfLength - 10);

  if (contourIntervalMeters !== undefined) {
    pen.font(10, mono);
    pen.text(`contours ${contourIntervalMeters} m`, halfWidth, -halfLength - 10, 'right');
  }

  const stepKm = pickScaleDistanceKm(place.widthKm / 5, place.widthKm);
  const segments = Math.max(1, Math.floor(place.widthKm / stepKm + 1e-9));
  const barWidth = ((segments * stepKm) / place.widthKm) * halfWidth * 2;
  const ticks = Array.from({ length: segments + 1 }, (_, index) => index * stepKm);

  paintScaleBar(pen, -halfWidth, halfLength + 14, barWidth, 6, ticks, segments, halfLength + 34);
}

/** Print registration corners carrying exact DMS bounds, with the name up the west edge. */
function paintCropMarkLabels(pen: FloorPen, place: FloorPlace): void {
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

/** Dashed graticule lines reach the faded edge of the floor. */
const graticuleReach = 380;

function getGraticule(place: FloorPlace): { latitudes: number[]; longitudes: number[] } {
  const { bounds } = place;
  const step = pickGraticuleStep(
    Math.max(bounds.north - bounds.south, bounds.east - bounds.west),
    5,
  );

  return {
    latitudes: graticuleValues(bounds.south, bounds.north, step),
    longitudes: graticuleValues(bounds.west, bounds.east, step),
  };
}

function toModelX(pen: FloorPen, place: FloorPlace, longitude: number): number {
  return -pen.halfWidth + longitudeFraction(place.bounds, longitude) * pen.halfWidth * 2;
}

function toModelY(pen: FloorPen, place: FloorPlace, latitude: number): number {
  return -pen.halfLength + latitudeFraction(place.bounds, latitude) * pen.halfLength * 2;
}

/** The ring clears the model's corners: 330 mock px for a square model. */
function getRoseRadius(pen: FloorPen): number {
  return Math.max(330, Math.hypot(pen.halfWidth, pen.halfLength) + 75);
}

function toBearingPoint(bearingDegrees: number, radius: number): [number, number] {
  const angle = ((bearingDegrees - 90) * Math.PI) / 180;

  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

function formatDecimalPair(place: FloorPlace): string {
  return `${formatDecimal(place.latitude, 'lat')} ${formatDecimal(place.longitude, 'lon')}`;
}

function formatModelSize(place: FloorPlace): string {
  return `${formatKm(place.widthKm)} × ${formatKm(place.lengthKm)} km`;
}

/** Square and circular models print one distance: "25 KM". */
function formatModelSpan(place: FloorPlace): string {
  return place.widthKm === place.lengthKm
    ? `${formatKm(place.widthKm)} KM`
    : formatModelSize(place).toUpperCase();
}

function formatKm(km: number): number {
  return Number(km.toPrecision(3));
}
