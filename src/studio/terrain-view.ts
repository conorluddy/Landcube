import type { StudioController, SceneSettings, StudioView } from './controller';
import type { Terrain3d } from '../terrain-3d';
import type { Contour } from '../types/contours';
import type { DesignSettings } from '../types/design';
import type { HeightField } from '../types/terrain';
import type { SeaLevelGeometry } from '../sea-level';
import type { TerrainTerraceLevels } from '../terrain-terraces';
import type { FloorPlace } from '../floor-geo';
import type { RoadPath } from '../types/roads';
import type { GrassGeography } from '../grass-coverage';
import type { TerrainRouteOverlay } from '../terrain-3d-route';
import type { FramePoint } from '../real-terrain-projection';
import { getAutoRotateSpeed, type TerrainViewPreset } from '../terrain-camera';
import { createShellMotion } from './shell-motion';
import { createCameraPosePublisher } from './camera-pose';

interface StudioTerrainView {
  isActive: () => boolean;
  activate: (mode: StudioView) => Promise<void>;
  /** Stops drawing while the canvas is hidden behind design-system mode; resumes on false. */
  setSuspended: (isSuspended: boolean) => void;
  sceneChanged: (previous: SceneSettings) => void;
  modelChanged: () => void;
  frameChanged: () => void;
  resetCamera: () => void;
  applyViewPreset: (preset: TerrainViewPreset) => void;
  pickFocus: () => Promise<boolean>;
  captureStill: (scale: number) => HTMLCanvasElement;
  /** Arms a morph for the next 3D rebuild; the 2D view and an inactive 3D view always cut. */
  requestTransition: () => void;
  getStl: () => ArrayBuffer;
  /** The model point under a viewport position while 3D is active, as fractions across the model. */
  getSurfaceFractionAt: (clientX: number, clientY: number) => { x: number; y: number } | undefined;
  /** The profile-inspection marker, in model-crop units; main re-sends it after each 3D update. */
  setRouteMarker: (point: FramePoint | undefined) => void;
  /** Viewport pixels of a crop-unit point on the displayed 3D surface. */
  projectCropPointToClient: (point: FramePoint) => { clientX: number; clientY: number } | undefined;
  /** Runs after each drawn 3D frame, so overlays can follow the camera; returns an unsubscribe. */
  subscribeDraw: (listener: () => void) => () => void;
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
    roads?: readonly RoadPath[],
    grassGeography?: GrassGeography,
    route?: TerrainRouteOverlay,
  ) => void;
}

/** Adapts studio snapshots to the lazy WebGL renderer; never reads form controls. */
export function createStudioTerrainView(
  controller: StudioController,
  changed: () => void,
): StudioTerrainView {
  let view: Terrain3d | undefined;
  let active = false;
  let suspended = false;
  let floorPlace: FloorPlace | undefined;
  let interval: number | undefined;
  // The 3D module loads lazily, so listeners live here and are fanned out from one view subscription.
  const drawListeners = new Set<() => void>();
  const motion = createShellMotion(() => document.querySelector('.studio-shell'));
  const posePublisher = createCameraPosePublisher(
    (pose) => {
      controller.cameraPose(pose);
    },
    {
      now: () => performance.now(),
      setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
      clearTimeout: (timer) => {
        window.clearTimeout(timer);
      },
    },
  );

  const syncFrame = () => {
    const { frame, model } = controller.getSnapshot();
    const { assembly, settings } = frame;

    // The frame scales with the model, so it must never see stale dimensions.
    view?.setModelSettings(model.dimensions);

    if (assembly?.ok === true) {
      view?.setFrame(assembly.data.parts, assembly.data.seatHeightMm, settings.finish);
    } else {
      view?.setFrame([], 0, settings.finish);
    }
  };

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

    if (differs('roads')) {
      view.setRoadStyle(scene.roads);
    }

    if (differs('grass')) {
      view.setGrassStyle(scene.grass);
    }

    if (differs('rotationSeconds') || differs('rotationDirection')) {
      view.setRotationSpeed(getAutoRotateSpeed(scene.rotationSeconds, scene.rotationDirection));
    }

    if (differs('rotating')) {
      view.setRotating(scene.rotating);
      motion.setHeld('turntable', active && scene.rotating);
    }

    if (differs('camera')) {
      view.setCamera(scene.camera);
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

        view = module.createTerrain3d(
          (height, layerHeight) => {
            controller.metrics(height, layerHeight);
          },
          () => {
            if (view) {
              posePublisher.offer(view.getCameraPose());
            }
          },
        );
        view.subscribeDraw(() => {
          for (const listener of drawListeners) {
            listener();
          }
        });
        const canvas = document.querySelector<HTMLCanvasElement>('canvas.terrain-3d');

        if (canvas) {
          motion.watchCanvas(canvas);
        }

        syncScene();
      }

      active = mode === '3d';
      motion.setHeld('turntable', active && controller.getSnapshot().scene.rotating);
      document.querySelector('#terrain')?.toggleAttribute('hidden', active);
      view?.setVisible(active && !suspended);

      if (view && active) {
        const model = controller.getSnapshot().model;

        view.setModelSettings(model.dimensions);
        view.setHeight(model.exaggeration);
        syncFrame();
      }

      changed();
    },
    setSuspended(isSuspended) {
      suspended = isSuspended;
      view?.setVisible(active && !suspended);
    },
    sceneChanged: syncScene,
    frameChanged() {
      syncFrame();
      changed();
    },
    modelChanged() {
      const model = controller.getSnapshot().model;

      view?.setModelSettings(model.dimensions);
      view?.setHeight(model.exaggeration);
      changed();
    },
    resetCamera: () => view?.reset(),
    applyViewPreset: (preset) => view?.applyViewPreset(preset),
    pickFocus: () => view?.pickFocus() ?? Promise.resolve(false),
    captureStill(scale) {
      if (!view || !active) {
        throw new Error('Select the 3D view before downloading a 3D still.');
      }

      return view.captureStill(scale);
    },
    requestTransition() {
      if (active) {
        view?.requestTransition();
      }
    },
    getSurfaceFractionAt: (clientX, clientY) =>
      active ? view?.getSurfaceFractionAt(clientX, clientY) : undefined,
    setRouteMarker: (point) => view?.setRouteMarker(point),
    projectCropPointToClient: (point) =>
      active ? view?.projectCropPointToClient(point) : undefined,
    subscribeDraw(listener) {
      drawListeners.add(listener);

      return () => {
        drawListeners.delete(listener);
      };
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
      roads?: readonly RoadPath[],
      grassGeography?: GrassGeography,
      route?: TerrainRouteOverlay,
    ) {
      floorPlace = place;
      interval = contourIntervalMeters;

      if (active && view) {
        const { scene } = controller.getSnapshot();

        view.setLighting(scene.lighting);
        view.setHeight(controller.getSnapshot().model.exaggeration, false);
        view.setMapGrid(
          scene.mapGrid && floorPlace !== undefined,
          floorPlace,
          interval,
          scene.floorStyle,
        );
        view.update(
          contours,
          width,
          height,
          settings,
          field,
          seaLevel,
          terraceLevels,
          roads,
          grassGeography,
          route,
        );
      }
    },
  };
}
