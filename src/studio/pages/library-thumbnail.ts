import { fitThumbnail } from '../../saved-designs';
import { validateDesignSettings } from '../../design-settings';
import { createExportPreviewSvg } from '../../export/image-export';
import type { OutputRenderer } from '../../types/export';
import type { ValidatedDesignSettings } from '../../types/design';

const thumbnailWidthPixels = 200;
const thumbnailHeightPixels = 132;
/** Fewer contours keep generated SVGs small; 9 is within the valid odd-step range. */
const thumbnailMaximumContourCount = 9;
/** Real terrain ignores the contour count and draws far denser lines, so points are thinned until it fits. */
const pointThinningSteps = [1, 2, 3, 4, 6, 8, 12, 16, 24];

/**
 * A small SVG preview of `design` for the Library, rendered through the export pipeline at thumbnail
 * size with coordinates rounded to a tenth of a pixel and path points thinned until it fits the
 * storage budget. Null when the design cannot be re-validated at that size or never fits.
 */
export function createDesignThumbnailSvg(
  design: ValidatedDesignSettings,
  renderer: OutputRenderer,
): string | null {
  const small = validateDesignSettings({
    ...design,
    width: thumbnailWidthPixels,
    height: thumbnailHeightPixels,
    contourCount: Math.min(design.contourCount, thumbnailMaximumContourCount),
  });

  if (!small.ok) {
    return null;
  }

  const svg = createExportPreviewSvg(small.data, renderer)
    .replace(/<text\b[\s\S]*?<\/text>/g, '')
    .replace(/(\d+\.\d)\d+/g, '$1');

  for (const step of pointThinningSteps) {
    const thumbnail = fitThumbnail(thinPathPoints(svg, step));

    if (thumbnail !== null) {
      return thumbnail;
    }
  }

  return null;
}

/** Keeps every `step`th point of each path (plus each subpath start and the last point). */
export function thinPathPoints(svg: string, step: number): string {
  if (step <= 1) {
    return svg;
  }

  return svg.replace(/ d="([^"]*)"/g, (_match, pathData: string) => {
    const commands = pathData.split(/(?=[ML])/);
    const kept = commands.filter(
      (command, index) =>
        command.startsWith('M') || index % step === 0 || index === commands.length - 1,
    );

    return ` d="${kept.join('')}"`;
  });
}
