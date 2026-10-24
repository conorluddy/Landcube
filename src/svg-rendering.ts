import type { Contour } from './types/contours';
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
): void {
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.innerHTML = getContourMarkup(contours, settings);
}

/** Creates a standalone, clipped SVG with explicit appearance settings. */
export function createSvgDocument(contours: Contour[], settings: Readonly<DesignSettings>): string {
  const { width, height, background, transparent } = settings;
  const backdrop = transparent
    ? ''
    : `<rect width="${width}" height="${height}" fill="${background}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" overflow="hidden"><defs><clipPath id="landscape-crop"><rect width="${width}" height="${height}"/></clipPath></defs><g clip-path="url(#landscape-crop)">${backdrop}${getContourMarkup(contours, settings)}</g></svg>`;
}

/** Groups ordinary and index contours into consistently styled paths. */
function getContourMarkup(contours: Contour[], settings: Readonly<DesignSettings>): string {
  const interval = contours.length > 1 ? contours[1].elevation - contours[0].elevation : 1;
  /** Recognizes index levels despite floating-point elevation rounding. */
  const isIndexContour = (contour: Contour) => {
    if (settings.indexStyle === 'off') {
      return false;
    }
    const multiple = contour.elevation / (interval * settings.indexEvery);
    return Math.abs(multiple - Math.round(multiple)) < indexContourElevationTolerance;
  };
  return [false, true]
    .map((index) => {
      /** Keeps index strokes separate while preserving contour topology. */
      const dashAttribute =
        index && settings.indexStyle === 'dashed'
          ? ` stroke-dasharray="${settings.dashLength} ${settings.dashGap}"`
          : '';
      const pathData = contours
        .filter((contour) => isIndexContour(contour) === index)
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
      return `<path fill="none" stroke="${settings.lineColor}" stroke-width="${index ? settings.indexStrokeWidth : settings.strokeWidth}" stroke-opacity="${settings.strokeOpacity}" stroke-linejoin="round" stroke-linecap="round"${dashAttribute} d="${pathData}"/>`;
    })
    .join('');
}
