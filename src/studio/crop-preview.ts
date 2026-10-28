import { mountTerrainCropControls } from '../terrain-crop-controls';
import type { StudioController } from './controller';
import type { TerrainModelSettings } from '../terrain-model';

export interface CropPreview {
  attach: (container: HTMLElement) => () => void;
  update: (...args: Parameters<ReturnType<typeof mountTerrainCropControls>['update']>) => void;
}

/** The canvas/SVG crop widget keeps gesture state; committed selections belong to the project. */
export function createCropPreview(controller: StudioController): CropPreview {
  let widget: ReturnType<typeof mountTerrainCropControls> | undefined;
  let latest: Parameters<ReturnType<typeof mountTerrainCropControls>['update']> | undefined;

  return {
    attach(container: HTMLElement) {
      widget = mountTerrainCropControls(
        container,
        () => controller.getSnapshot().model.dimensions,
        (shape, polygon, ratio) => {
          const crop = widget?.getCrop();
          const dimensions = controller.getSnapshot().model.dimensions;

          if (crop) {
            controller.model({
              crop,
              dimensions: {
                ...dimensions,
                ...(ratio === undefined ? {} : getReshapedDimensions(dimensions, ratio)),
                cropShape: shape,
                cropPolygon: polygon,
              },
            });
          }
        },
        () => controller.getSnapshot().model.crop,
      );

      if (latest) {
        widget.update(...latest);
      }

      return () => {
        widget?.dispose();
        widget = undefined;
      };
    },
    update(...args: Parameters<ReturnType<typeof mountTerrainCropControls>['update']>) {
      latest = args;
      widget?.update(...args);
    },
  };
}

/** Keeps the longer printed side and derives the other from the crop's width ÷ length. */
function getReshapedDimensions(
  dimensions: TerrainModelSettings,
  ratio: number,
): Pick<TerrainModelSettings, 'widthMm' | 'lengthMm'> {
  const longerMm = Math.max(dimensions.widthMm, dimensions.lengthMm);
  const shorterMm = (value: number) => Math.max(1, Math.round(value * 10) / 10);

  return ratio >= 1
    ? { widthMm: longerMm, lengthMm: shorterMm(longerMm / ratio) }
    : { widthMm: shorterMm(longerMm * ratio), lengthMm: longerMm };
}
