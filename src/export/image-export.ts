import type { RealTerrain } from '../real-terrain';
import {
  maximumOutputDimensionPixels,
  maximumExtraLargeOutputDimensionPixels,
} from '../constants/design';
import {
  downloadUrlReleaseDelayMs,
  imageMimeTypes,
  maximumPreviewDimensionPixels,
} from '../constants/export';
import { operationErrorCodes } from '../constants/operations';
import { generateLandscapeGeometry } from '../landscape-composition';
import { createSvgDocument } from '../svg-rendering';
import type { DesignSettings, ValidatedDesignSettings } from '../types/design';
import type { ImageDimensions } from '../types/dimensions';
import type { ExportFile, OutputRenderer } from '../types/export';
import type { Result } from '../types/operations';
import type { EngineConfiguration } from '../types/terrain';

// === PUBLIC API ===
/** Caches settled geometry independently of appearance and cursor animation. */
export function createOutputRenderer(
  engineConfiguration: Readonly<EngineConfiguration>,
  getRealTerrain: () => RealTerrain | undefined = () => undefined,
): OutputRenderer {
  let cachedRealTerrain: RealTerrain | undefined;
  let cachedGeometryKey: string | undefined;
  let geometry: ReturnType<typeof generateLandscapeGeometry> = { contours: [], summits: [] };

  return {
    /** Reuses cached contours until a geometry-affecting setting changes. */
    getSvg(settings) {
      const geometryCacheKey = JSON.stringify([
        settings.seed,
        settings.featureScale,
        settings.detail,
        settings.contourCount,
        settings.width,
        settings.height,
      ]);

      const realTerrain = getRealTerrain();

      if (geometryCacheKey !== cachedGeometryKey || realTerrain !== cachedRealTerrain) {
        geometry = generateLandscapeGeometry(settings, engineConfiguration, realTerrain);
        cachedRealTerrain = realTerrain;
        cachedGeometryKey = geometryCacheKey;
      }

      return createSvgDocument(
        geometry.contours,
        settings,
        geometry.summits,
        realTerrain?.attribution,
        geometry.seaLevel,
      );
    },
  };
}

/** Caps the preview's intrinsic raster size while preserving the full export framing and geometry. */
export function createExportPreviewSvg(
  settings: ValidatedDesignSettings,
  renderer: OutputRenderer,
): string {
  const scale = Math.min(
    1,
    maximumPreviewDimensionPixels / Math.max(settings.width, settings.height),
  );
  const width = Math.max(1, Math.round(settings.width * scale));
  const height = Math.max(1, Math.round(settings.height * scale));

  return renderer
    .getSvg(settings)
    .replace(/^<svg\b[^>]*>/, (root) =>
      root
        .replace(/\bwidth="[^"]*"/, `width="${width}"`)
        .replace(/\bheight="[^"]*"/, `height="${height}"`),
    );
}

/** Rejects PNG scales that exceed the final pixel budget. */
export function getRasterDimensions(settings: Readonly<DesignSettings>): Result<ImageDimensions> {
  const width = settings.width * settings.pngScale;
  const height = settings.height * settings.pngScale;

  const maximumDimensionPixels = settings.allowExtraLargeExports
    ? maximumExtraLargeOutputDimensionPixels
    : maximumOutputDimensionPixels;

  if (width > maximumDimensionPixels || height > maximumDimensionPixels) {
    return {
      ok: false,
      error: {
        code: operationErrorCodes.invalidSettings,
        message: `PNG dimensions must be at most ${maximumDimensionPixels} px per side. Choose 1× or reduce the output size.`,
        retryable: true,
      },
    };
  }

  return { ok: true, data: { width, height } };
}

/** Captures the selected format and dimensions in a downloadable image. */
export async function createExportFile(
  settings: ValidatedDesignSettings,
  renderer: OutputRenderer,
): Promise<Result<ExportFile>> {
  const dimensions =
    settings.format === 'png'
      ? getRasterDimensions(settings)
      : { ok: true as const, data: { width: settings.width, height: settings.height } };

  if (!dimensions.ok) {
    return dimensions;
  }

  try {
    const svg = renderer.getSvg(settings);
    const blob =
      settings.format === 'svg'
        ? new Blob([svg], { type: imageMimeTypes.svg })
        : await encodeSvgAsPng(svg, dimensions.data.width, dimensions.data.height);

    return {
      ok: true,
      data: {
        blob,
        filename: `landcube-${settings.seed}-${dimensions.data.width}x${dimensions.data.height}.${settings.format}`,
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

/** Starts a browser download and releases temporary resources. */
export function downloadExport(file: ExportFile): Result<void> {
  let url: string | undefined;

  try {
    url = URL.createObjectURL(file.blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = file.filename;
    document.body.append(anchor);

    try {
      anchor.click();
    } finally {
      anchor.remove();
    }

    const downloadUrl = url;

    setTimeout(() => {
      URL.revokeObjectURL(downloadUrl);
    }, downloadUrlReleaseDelayMs);

    return { ok: true, data: undefined };
  } catch {
    if (url !== undefined) {
      URL.revokeObjectURL(url);
    }

    return {
      ok: false,
      error: {
        code: operationErrorCodes.exportFailed,
        message: 'Download could not start. Allow downloads for this page and try again.',
        retryable: true,
      },
    };
  }
}

/** Encodes SVG through canvas and releases resources on every exit path. */
async function encodeSvgAsPng(svg: string, width: number, height: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: imageMimeTypes.svg }));
  let image: HTMLImageElement | undefined;
  let canvas: HTMLCanvasElement | undefined;

  try {
    image = new Image();
    canvas = document.createElement('canvas');
    const loadingImage = image;

    await new Promise<void>((resolve, reject) => {
      /** Waits for SVG decoding before attempting canvas encoding. */
      loadingImage.onload = () => {
        resolve();
      };

      loadingImage.onerror = () => {
        reject(new Error('SVG decoding failed'));
      };

      loadingImage.src = url;
    });
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas is unavailable');
    }

    context.drawImage(image, 0, 0, width, height);
    const encodingCanvas = canvas;

    return await new Promise<Blob>((resolve, reject) => {
      encodingCanvas.toBlob((blob) => {
        if (blob === null) {
          reject(new Error('PNG encoding failed'));
        } else {
          resolve(blob);
        }
      }, imageMimeTypes.png);
    });
  } finally {
    URL.revokeObjectURL(url);

    if (image) {
      image.onload = image.onerror = null;
      image.src = '';
    }

    if (canvas) {
      canvas.width = canvas.height = 0;
    }
  }
}
