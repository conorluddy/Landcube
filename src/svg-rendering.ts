import { getContourStyle } from './contour-style';
import { createSeaLevelMarkup, type SeaLevelGeometry } from './sea-level';
import { createSummitMarkerMarkup, updateLiveSummitMarkers } from './summit-markers';
import type { Contour, ContourPoint } from './types/contours';
import type { DesignSettings } from './types/design';

const svgCoordinateDecimalPlaces = 3;

// === PUBLIC API ===
/** Updates the live SVG without introducing export-only markup. */
export function renderContoursIntoSvg(
  svg: SVGSVGElement,
  contours: Contour[],
  width: number,
  height: number,
  settings: Readonly<DesignSettings>,
  summits: readonly ContourPoint[] = [],
  seaLevel?: SeaLevelGeometry,
): void {
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  let contourLayer = svg.querySelector<SVGGElement>('[data-contours]');

  if (!contourLayer) {
    contourLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    contourLayer.setAttribute('data-contours', '');
    svg.prepend(contourLayer);
  }

  contourLayer.innerHTML =
    createSeaLevelMarkup(seaLevel, settings.lineColor) +
    createGridMarkup(width, height, settings) +
    getContourMarkup(contours, settings);
  updateLiveSummitMarkers(svg, summits, settings);
}

/** Creates a standalone, clipped SVG with explicit appearance settings. */
export function createSvgDocument(
  contours: Contour[],
  settings: Readonly<DesignSettings>,
  summits: readonly ContourPoint[] = [],
  attribution?: string,
  seaLevel?: SeaLevelGeometry,
): string {
  const { width, height, background, transparent } = settings;
  const backdrop = transparent
    ? ''
    : `<rect width="${width}" height="${height}" fill="${background}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" overflow="hidden">${attribution !== undefined ? `<metadata>${attribution}</metadata>` : ''}<defs><clipPath id="landscape-crop"><rect width="${width}" height="${height}"/></clipPath></defs><g clip-path="url(#landscape-crop)">${backdrop}${createSeaLevelMarkup(seaLevel, settings.lineColor)}${createGridMarkup(width, height, settings)}${getContourMarkup(contours, settings)}${createSummitMarkerMarkup(summits, settings)}${attribution !== undefined ? `<text x="8" y="${height - 8}" fill="${settings.lineColor}" font-family="sans-serif" font-size="${Math.min(9, ((width - 16) / Math.max(1, attribution.length)) * 1.6)}">${attribution}</text>` : ''}</g></svg>`;
}

/** Groups ordinary and index contours into consistently styled paths. */
function getContourMarkup(contours: Contour[], settings: Readonly<DesignSettings>): string {
  const interval = contours.length > 1 ? contours[1].elevation - contours[0].elevation : 1;

  const styles =
    settings.indexStyle === 'alternating'
      ? (['ordinary', 'solid', 'dashed'] as const)
      : (['ordinary', settings.indexStyle === 'dashed' ? 'dashed' : 'solid'] as const);

  return styles
    .map((style) => {
      const isIndex = style !== 'ordinary';
      const dashAttribute =
        style === 'dashed' ? ` stroke-dasharray="${settings.dashLength} ${settings.dashGap}"` : '';
      const pathData = contours
        .filter((contour) => getContourStyle(contour.elevation, interval, settings) === style)
        .flatMap((contour) =>
          contour.paths.map(
            ({ points, closed }) =>
              points
                .map(
                  (point, pointIndex) =>
                    `${pointIndex === 0 ? 'M' : 'L'}${point.x.toFixed(svgCoordinateDecimalPlaces)},${point.y.toFixed(svgCoordinateDecimalPlaces)}`,
                )
                .join('') + (closed ? 'Z' : ''),
          ),
        )
        .join('');

      return `<path fill="none" stroke="${settings.lineColor}" stroke-width="${isIndex ? settings.indexStrokeWidth : settings.strokeWidth}" stroke-opacity="${settings.strokeOpacity}" stroke-linejoin="round" stroke-linecap="round"${dashAttribute} d="${pathData}"/>`;
    })
    .join('');
}

/** Draws a decorative grid with identical framing in live views and exports. */
export function createGridMarkup(
  width: number,
  height: number,
  settings: Readonly<DesignSettings>,
): string {
  if (settings.gridStyle === 'off') {
    return '';
  }

  const spacing = settings.gridSpacing;
  const mark =
    settings.gridStyle === 'squares'
      ? `<path d="M${spacing},0H0V${spacing}"/>`
      : `<path d="M${spacing / 2 - 4},${spacing / 2}h8M${spacing / 2},${spacing / 2 - 4}v8"/>`;

  return `<defs><pattern id="terrain-grid" width="${spacing}" height="${spacing}" patternUnits="userSpaceOnUse"><g fill="none" stroke="${settings.lineColor}" stroke-width="0.6">${mark}</g></pattern></defs><rect width="${width}" height="${height}" fill="url(#terrain-grid)" opacity="${settings.gridOpacity}"/>`;
}
