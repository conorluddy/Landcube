import { mountTerrainCropControls } from '../terrain-crop-controls';
import type { StudioController } from './controller';

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
        (shape, polygon) => {
          const crop = widget?.getCrop();

          if (crop) {
            controller.model({
              crop,
              dimensions: {
                ...controller.getSnapshot().model.dimensions,
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
