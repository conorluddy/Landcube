import type { StudioController, SceneSettings, StudioView } from './controller';
import type { Terrain3d } from '../terrain-3d';
import type { Contour } from '../types/contours';
import type { DesignSettings } from '../types/design';
import type { HeightField } from '../types/terrain';
import type { SeaLevelGeometry } from '../sea-level';
import type { TerrainTerraceLevels } from '../terrain-terraces';
import type { FloorPlace } from '../floor-geo';

interface StudioTerrainView {
  isActive: () => boolean;
  activate: (mode: StudioView) => Promise<void>;
  sceneChanged: (previous: SceneSettings) => void;
  modelChanged: () => void;
  resetCamera: () => void;
  /** Arms a morph for the next 3D rebuild; the 2D view and an inactive 3D view always cut. */
  requestTransition: () => void;
  getStl: () => ArrayBuffer;
  update: (
    contours: Contour[],
    width: number,
    height: number,
    settings: DesignSettings,
    field: HeightField,
    seaLevel?: SeaLevelGeometry,
    attribution?: string,
    place?: FloorPlace,
    contourIntervalMeters?: number,
    terraceLevels?: TerrainTerraceLevels,
  ) => void;
}

/** Adapts studio snapshots to the lazy WebGL renderer; never reads form controls. */
export function createStudioTerrainView(
  controller: StudioController,
  changed: () => void,
): StudioTerrainView {
  let view: Terrain3d | undefined;
  let active = false;
  let floorPlace: FloorPlace | undefined;
  let interval: number | undefined;

  const syncScene = (previous?: SceneSettings) => {
    if (!view) {
      return;
    }

    const scene = controller.getSnapshot().scene;
    const differs = (key: keyof SceneSettings) => scene[key] !== previous?.[key];

    if (differs('engraving')) {
      view.setContourEngraving(scene.engraving);
    }

    if (differs('gradient')) {
      view.setElevationGradient(scene.gradient);
    }

    if (differs('landFinish')) {
      view.setLandFinish(scene.landFinish);
    }

    if (differs('waterFinish')) {
      view.setWaterFinish(scene.waterFinish);
    }

    if (differs('waterOpacity')) {
      view.setWaterOpacity(scene.waterOpacity);
    }

    if (differs('previewWater') || differs('previewWaterLevel')) {
      view.setPreviewWaterLevel(scene.previewWater ? scene.previewWaterLevel : undefined);
    }

    if (differs('surface')) {
      view.setSurface(scene.surface);
    }

    if (differs('base')) {
      view.setBase(scene.base);
    }

    if (differs('surfaceMatch') || differs('surfaceColor')) {
      view.setSurfaceColor(scene.surfaceMatch ? undefined : scene.surfaceColor);
    }

    if (differs('ground')) {
      view.setGround(scene.ground);
    }

    if (differs('groundMatch') || differs('groundColor')) {
      view.setGroundColor(scene.groundMatch ? undefined : scene.groundColor);
    }

    if (differs('waterStyle')) {
      view.setWaterStyle(scene.waterStyle);
    }

    if (differs('waterMatch') || differs('waterColor')) {
      view.setWaterColor(scene.waterMatch ? undefined : scene.waterColor);
    }

    if (differs('contours')) {
      view.setContours(scene.contours);
    }

    if (differs('rotating')) {
      view.setRotating(scene.rotating);
    }

    if (differs('lighting')) {
      view.setLighting(scene.lighting);
    }

    view.setMapGrid(
      scene.mapGrid && floorPlace !== undefined,
      floorPlace,
      interval,
      scene.floorStyle,
    );
  };

  return {
    isActive: () => active,
    async activate(mode: StudioView) {
      if (mode === '3d' && !view) {
        const module = await import('../terrain-3d');

        view = module.createTerrain3d((height, layerHeight) => {
          controller.metrics(height, layerHeight);
        });
        syncScene();
      }

      active = mode === '3d';
      document.querySelector('#terrain')?.toggleAttribute('hidden', active);
      view?.setVisible(active);

      if (view && active) {
        const model = controller.getSnapshot().model;

        view.setModelSettings(model.dimensions);
        view.setHeight(model.exaggeration);
      }

      changed();
    },
    sceneChanged: syncScene,
    modelChanged() {
      const model = controller.getSnapshot().model;

      view?.setModelSettings(model.dimensions);
      view?.setHeight(model.exaggeration);
      changed();
    },
    resetCamera: () => view?.reset(),
    requestTransition() {
      if (active) {
        view?.requestTransition();
      }
    },
    getStl() {
      if (!view || !active) {
        throw new Error('Select the 3D view before downloading STL.');
      }

      return view.getStl();
    },
    update(
      contours: Contour[],
      width: number,
      height: number,
      settings: DesignSettings,
      field: HeightField,
      seaLevel?: SeaLevelGeometry,
      _attribution?: string,
      place?: FloorPlace,
      contourIntervalMeters?: number,
      terraceLevels?: TerrainTerraceLevels,
    ) {
      floorPlace = place;
      interval = contourIntervalMeters;

      if (active && view) {
        const { scene } = controller.getSnapshot();

        view.setLighting(scene.lighting);
        view.setMapGrid(
          scene.mapGrid && floorPlace !== undefined,
          floorPlace,
          interval,
          scene.floorStyle,
        );
        view.update(contours, width, height, settings, field, seaLevel, terraceLevels);
      }
    },
  };
}
