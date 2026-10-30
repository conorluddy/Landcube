import { Resvg } from '@resvg/resvg-js';
import { imageMimeTypes } from '../constants/export';
import { operationErrorCodes } from '../constants/operations';
import type { ValidatedDesignSettings } from '../types/design';
import type { OutputRenderer } from '../types/export';
import type { Result } from '../types/operations';
import { getRasterDimensions } from './image-export';

/** A fully rendered image ready for Node file or stdout delivery. */
export interface NodeExportFile {
  bytes: Uint8Array;
  filename: string;
  mimeType: (typeof imageMimeTypes)[keyof typeof imageMimeTypes];
}

// === PUBLIC API ===
/** Creates SVG or PNG bytes with the same dimensions and limits as browser exports. */
export function createNodeExportFile(
  settings: ValidatedDesignSettings,
  renderer: OutputRenderer,
): Result<NodeExportFile> {
  const dimensions =
    settings.format === 'png'
      ? getRasterDimensions(settings)
      : { ok: true as const, data: { width: settings.width, height: settings.height } };

  if (!dimensions.ok) {
    return dimensions;
  }

  try {
    const svg = renderer.getSvg(settings);
    const bytes =
      settings.format === 'svg'
        ? new TextEncoder().encode(svg)
        : rasterizeSvgAsPng(svg, dimensions.data.width);

    return {
      ok: true,
      data: {
        bytes,
        filename: `landcube-${settings.seed}-${dimensions.data.width}x${dimensions.data.height}.${settings.format}`,
        mimeType: imageMimeTypes[settings.format],
      },
    };
  } catch {
    return {
      ok: false,
      error: {
        code: operationErrorCodes.exportFailed,
        message: 'Could not create the image. Try a smaller output size or export SVG.',
        retryable: true,
      },
    };
  }
}

/** Rasterizes the standalone SVG through Resvg, retaining transparent pixels when present. */
function rasterizeSvgAsPng(svg: string, width: number): Uint8Array {
  return new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
}
