import { summitMarkerSizeScales } from './constants/design';
import type { ContourPoint } from './types/contours';
import type { DesignSettings } from './types/design';
import type { HeightField } from './types/terrain';

const minimumSummitSeparationPixels = 40;

/** Finds positive local maxima, retaining the highest peak when markers would overlap. */
export function findTerrainSummits(field: HeightField): ContourPoint[] {
  const { columns, rows, values, originX, originY, spacing } = field;
  const candidates: (ContourPoint & { elevation: number })[] = [];

  for (let row = 1; row < rows - 1; row++) {
    for (let column = 1; column < columns - 1; column++) {
      const elevation = values[row * columns + column];

      if (elevation <= 0) {
        continue;
      }

      let isSummit = true;

      for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
        for (let columnOffset = -1; columnOffset <= 1; columnOffset++) {
          if (rowOffset === 0 && columnOffset === 0) {
            continue;
          }

          if (values[(row + rowOffset) * columns + column + columnOffset] >= elevation) {
            isSummit = false;
          }
        }
      }

      if (isSummit) {
        candidates.push({ x: originX + column * spacing, y: originY + row * spacing, elevation });
      }
    }
  }

  const summits: ContourPoint[] = [];

  for (const candidate of candidates.sort((first, second) => second.elevation - first.elevation)) {
    if (
      summits.every(
        (summit) =>
          Math.hypot(candidate.x - summit.x, candidate.y - summit.y) >=
          minimumSummitSeparationPixels,
      )
    ) {
      summits.push({ x: candidate.x, y: candidate.y });
    }
  }

  return summits;
}

/** Draws independent, label-free SVG symbols; both enabled forms a cross inside a triangle. */
export function createSummitMarkerMarkup(
  summits: readonly ContourPoint[],
  settings: Readonly<DesignSettings>,
): string {
  if (!settings.summitTrianglesEnabled && !settings.summitCrossesEnabled) {
    return '';
  }

  const scale = summitMarkerSizeScales[settings.summitMarkerSize];
  const triangle = settings.summitTrianglesEnabled ? '<path d="M0,-7L6,4L-6,4Z"/>' : '';
  const cross = settings.summitCrossesEnabled ? '<path d="M-2.5,0H2.5M0,-2.5V2.5"/>' : '';

  return `<g data-summit-markers fill="none" stroke="${settings.lineColor}" stroke-width="${settings.strokeWidth}" stroke-opacity="${settings.strokeOpacity}" stroke-linecap="round" stroke-linejoin="round">${summits.map(({ x, y }) => `<g transform="translate(${x},${y}) scale(${scale})">${triangle}${cross}</g>`).join('')}</g>`;
}
