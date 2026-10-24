import { createSummitMarkerMarkup } from './summit-markers';
import type { Contour, ContourPoint } from './types/contours';
import type { DesignSettings } from './types/design';

const indexContourElevationTolerance = 1e-6;
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
): void {
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.innerHTML =
    getContourMarkup(contours, settings) + createSummitMarkerMarkup(summits, settings);
}

/** Creates a standalone, clipped SVG with explicit appearance settings. */
export function createSvgDocument(
  contours: Contour[],
  settings: Readonly<DesignSettings>,
  summits: readonly ContourPoint[] = [],
): string {
  const { width, height, background, transparent } = settings;
  const backdrop = transparent
    ? ''
    : `<rect width="${width}" height="${height}" fill="${background}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" overflow="hidden"><defs><clipPath id="landscape-crop"><rect width="${width}" height="${height}"/></clipPath></defs><g clip-path="url(#landscape-crop)">${backdrop}${getContourMarkup(contours, settings)}${createSummitMarkerMarkup(summits, settings)}</g></svg>`;
}

/** Groups ordinary and index contours into consistently styled paths. */
function getContourMarkup(contours: Contour[], settings: Readonly<DesignSettings>): string {
  const interval = contours.length > 1 ? contours[1].elevation - contours[0].elevation : 1;

  /** Anchors alternation to elevation so negative levels and disconnected paths stay consistent. */
  const getContourStyle = (contour: Contour): 'ordinary' | 'solid' | 'dashed' => {
    if (settings.indexStyle === 'off') {
      return 'ordinary';
    }

    const multiple = contour.elevation / (interval * settings.indexEvery);
    const indexLevel = Math.round(multiple);

    if (Math.abs(multiple - indexLevel) >= indexContourElevationTolerance) {
      return 'ordinary';
    }

    return settings.indexStyle === 'dashed' ||
      (settings.indexStyle === 'alternating' && Math.abs(indexLevel % 2) === 1)
      ? 'dashed'
      : 'solid';
  };

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
        .filter((contour) => getContourStyle(contour) === style)
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
