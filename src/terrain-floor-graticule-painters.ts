import {
  formatDecimalPair,
  formatDms,
  formatModelSize,
  getPlaceGraticule,
  latitudeFraction,
  longitudeFraction,
  pickScaleDistanceKm,
  type FloorPlace,
} from './floor-geo';
import { inkAlpha, mono, paintScaleBar, sans, type FloorPen } from './terrain-floor-pen';

// Floor styles that plot the model's latitude and longitude lines.
// Geometry is in mock px (see terrain-floor-pen.ts) so numbers match the design handoff 1:1.

// === PUBLIC API ===

/** USGS-style double neatline with graticule ticks, scale bar, north arrow and title block. */
export function paintSurveyLabels(
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

  const { latitudes, longitudes } = getPlaceGraticule(place);

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

  const textWidth = block.width - 20;

  if (place.name !== undefined) {
    // Long names break at their em dash, then shrink until every line fits the block.
    const titleLines = place.name.toUpperCase().split(/\s+—\s+/);
    let titleSize = 15;

    pen.font(titleSize, sans, 700, 0.06);

    while (titleSize > 9 && titleLines.some((line) => pen.measure(line) > textWidth)) {
      titleSize -= 1;
      pen.font(titleSize, sans, 700, 0.06);
    }

    for (const line of titleLines) {
      pen.text(line, block.x + 10, cursor, 'left', 'top');
      cursor += titleSize + 4;
    }

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
    contourIntervalMeters === undefined ? undefined : `contours ${contourIntervalMeters} m`;
  const sizeLine = `${formatModelSize(place)} · ${contours}`;

  pen.font(10, mono);

  const detailLines = [
    formatDecimalPair(place),
    ...(contours === undefined
      ? [formatModelSize(place)]
      : pen.measure(sizeLine) <= textWidth
        ? [sizeLine]
        : [formatModelSize(place), contours]),
  ];

  for (const line of detailLines) {
    pen.text(line, block.x + 10, cursor, 'left', 'top');
    cursor += 13;
  }

  pen.stroke(inkAlpha.text, 2);
  pen.strokeRect(block.x, block.y, block.width, cursor + 5 - block.y);
}

export function paintGraticuleLines(pen: FloorPen, place: FloorPlace): void {
  const { latitudes, longitudes } = getPlaceGraticule(place);

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
export function paintGraticuleLabels(
  pen: FloorPen,
  place: FloorPlace,
  contourIntervalMeters: number | undefined,
): void {
  const { context, halfWidth, halfLength } = pen;
  const { latitudes, longitudes } = getPlaceGraticule(place);

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

// === HELPERS ===

/** Dashed graticule lines reach the faded edge of the floor. */
const graticuleReach = 380;

function toModelX(pen: FloorPen, place: FloorPlace, longitude: number): number {
  return -pen.halfWidth + longitudeFraction(place.bounds, longitude) * pen.halfWidth * 2;
}

function toModelY(pen: FloorPen, place: FloorPlace, latitude: number): number {
  return -pen.halfLength + latitudeFraction(place.bounds, latitude) * pen.halfLength * 2;
}
