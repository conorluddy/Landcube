import {
  defaultTerrainModelSettings,
  getSuggestedExaggeration,
  validateTerrainModelSettings,
  type TerrainModelSettings,
} from '../terrain-model';
import { defaultTerrainCrop, type TerrainCropSettings } from '../terrain-crop';
import {
  defaultContourEngraving,
  type ContourEngravingSettings,
} from '../terrain-contour-engraving';
import {
  defaultTerrainLighting,
  getSuggestedTerrainLightDirection,
  type TerrainLightingSettings,
} from '../terrain-lighting';
import {
  defaultRotationSeconds,
  defaultTerrainCameraSettings,
  terrainViewPresets,
  type TerrainCameraSettings,
  type TerrainViewPreset,
  type TurntableDirection,
} from '../terrain-camera';
import { terrainMaterialPresets, type LandFinish, type WaterFinish } from '../terrain-materials';
import {
  copyElevationGradient,
  elevationGradientPresets,
  getLandscapeGradientKey,
  landscapeGradientPresets,
  validateElevationGradient,
  type ElevationGradientSettings,
} from '../terrain-elevation-gradient';
import { realTerrainPresetGroups, realTerrainPresets } from '../constants/real-terrain';
import { loadBrowserRealTerrain } from '../browser-real-terrain';
import { validateRealContourInterval } from '../real-terrain-contours';
import type { RealTerrain } from '../real-terrain';
import type { DesignSettings, ValidatedDesignSettings } from '../types/design';
import type { Result } from '../types/operations';
import type { WaterStyle } from '../terrain-3d';
import type { FloorStyle } from '../terrain-floor-styles';
import type { TerrainStillScale } from '../export/still-export';

export type StudioView = '2d' | '3d';
export type InspectorSection = 'Terrain' | 'Contours' | 'Colour' | 'Scene' | 'Camera' | 'Model';
export const threeDOnlySections: readonly InspectorSection[] = ['Camera', 'Model'];
export interface SceneSettings {
  contours: boolean;
  engraving: ContourEngravingSettings;
  materialPreset: string;
  surface: boolean;
  base: boolean;
  landFinish: LandFinish;
  surfaceMatch: boolean;
  surfaceColor: string;
  gradient: ElevationGradientSettings;
  gradientPreset: string;
  /** 'location' follows the loaded place's landscape; any manual gradient choice sticks as 'user'. */
  gradientSource: 'location' | 'user';
  ground: boolean;
  groundMatch: boolean;
  groundColor: string;
  mapGrid: boolean;
  floorStyle: FloorStyle;
  waterStyle: WaterStyle;
  waterFinish: WaterFinish;
  waterMatch: boolean;
  waterColor: string;
  waterOpacity: number;
  previewWater: boolean;
  previewWaterLevel: number;
  lighting: TerrainLightingSettings;
  customLightDirection: boolean;
  camera: TerrainCameraSettings;
  rotating: boolean;
  rotationSeconds: number;
  rotationDirection: TurntableDirection;
}
export interface TerrainSourceState {
  selected: 'generated' | 'real';
  terrain?: RealTerrain;
  place: string;
  latitude: number;
  longitude: number;
  spanKm: number;
  maxDepth: number;
  elevationFloor?: number;
  interval: 'auto' | number;
  fixedInterval: number;
  hatching: boolean;
  loading: boolean;
  status: string;
  /** Steps through preset locations in menu order, waiting after each load settles. */
  autoplay: { enabled: boolean; delaySeconds: number };
}
export interface StudioState {
  design: ValidatedDesignSettings;
  source: TerrainSourceState;
  scene: SceneSettings;
  model: {
    dimensions: TerrainModelSettings;
    crop: TerrainCropSettings;
    exaggeration: number;
    /** Real locations suggest a height until the user moves the slider. */
    autoExaggeration: boolean;
  };
  workspace: {
    view: StudioView;
    activating: boolean;
    collapsed: boolean;
    sections: Record<StudioView, InspectorSection>;
    popover: 'Overlays' | 'Orbit' | null;
    exporting: boolean;
  };
  seedLocked: boolean;
  status: string;
  manualLink: string;
  metrics: { height?: number; layerHeight?: number };
}
export interface StudioEffects {
  /** Location and source changes morph the 3D terrain; interval and hatching edits cut. */
  applyTerrain(terrain: RealTerrain | undefined, shouldTransition: boolean): void;
  activate(view: StudioView): Promise<void>;
  sceneChanged(previous: SceneSettings): void;
  modelChanged(): void;
  resetCamera(): void;
  applyViewPreset(preset: TerrainViewPreset): void;
  pickFocus(): Promise<boolean>;
  /** Resolves to the saved image's pixel size. */
  downloadStill(scale: TerrainStillScale): Promise<{ width: number; height: number }>;
  downloadStl(): void;
}

export interface DesignControlActions {
  getSettings: () => ValidatedDesignSettings;
  updateSettings: (settings: DesignSettings) => boolean;
  newLandscape: () => void;
  isSeedLocked: boolean;
  lockSeed: (locked: boolean) => void;
  getShareUrl: () => string;
  copyLink: (url: string) => Promise<Result<void>>;
}
export interface StudioController {
  getSnapshot: () => StudioState;
  subscribe: (listener: () => void) => () => void;
  connect: (effects: StudioEffects) => void;
  sync: () => void;
  notify: (message: string) => void;
  workspace: (patch: Partial<StudioState['workspace']>) => void;
  dismissManualLink: () => void;
  design: (patch: Partial<DesignSettings>) => boolean;
  newLandscape: () => void;
  lockSeed: (value: boolean) => void;
  copyLink: () => Promise<void>;
  selectSection: (section: InspectorSection) => void;
  selectView: (view: StudioView) => Promise<void>;
  scene: (patch: Partial<SceneSettings>, custom?: boolean) => void;
  material: (key: string) => void;
  lighting: (patch: Partial<TerrainLightingSettings>) => void;
  resetLighting: () => void;
  camera: (patch: Partial<TerrainCameraSettings>) => void;
  resetCameraSettings: () => void;
  applyViewPreset: (preset: TerrainViewPreset) => void;
  /** Arms a one-off terrain click that sets the depth-of-field focus point. */
  pickFocus: () => Promise<void>;
  model: (patch: Partial<StudioState['model']>) => boolean;
  dimensions: (patch: Partial<TerrainModelSettings>) => boolean;
  metrics: (height: number, layerHeight?: number) => void;
  source: (patch: Partial<TerrainSourceState>) => void;
  useGenerated: () => void;
  /** Switches to real terrain, opening its location controls and loading the selected place. */
  useCoordinates: () => Promise<void>;
  loadTerrain: () => Promise<void>;
  autoplay: (patch: Partial<TerrainSourceState['autoplay']>) => Promise<void>;
  interval: (value: 'auto' | number) => boolean;
  hatching: (value: boolean) => void;
  resetCamera: () => void;
  downloadStl: () => void;
  downloadStill: (scale: TerrainStillScale) => Promise<void>;
}

/** Session state is independent of controls, rendering and version-one URL serialization. */
export function createStudioController(actions: DesignControlActions): StudioController {
  const first = realTerrainPresets[0];
  const natural = terrainMaterialPresets.natural;
  let state: StudioState = {
    design: actions.getSettings(),
    source: {
      selected: 'generated',
      place: `${first.latitude},${first.longitude}`,
      latitude: first.latitude,
      longitude: first.longitude,
      spanKm: first.spanKm,
      maxDepth: 50,
      interval: 'auto',
      fixedInterval: 25,
      hatching: true,
      loading: false,
      status: '',
      autoplay: { enabled: false, delaySeconds: 10 },
    },
    scene: {
      contours: true,
      engraving: { ...defaultContourEngraving },
      materialPreset: 'natural',
      surface: true,
      base: true,
      landFinish: natural.landFinish,
      surfaceMatch: false,
      surfaceColor: natural.land,
      gradient: copyElevationGradient({
        enabled: false,
        transition: 'soft',
        stops: elevationGradientPresets.paper.stops,
      }),
      gradientPreset: 'paper',
      gradientSource: 'location',
      ground: true,
      groundMatch: false,
      groundColor: '#b4b4b4',
      mapGrid: true,
      floorStyle: 'survey',
      waterStyle: 'solid',
      waterFinish: 'translucent',
      waterMatch: false,
      waterColor: natural.water,
      waterOpacity: 0.4,
      previewWater: false,
      previewWaterLevel: 0.4,
      lighting: { ...defaultTerrainLighting },
      customLightDirection: false,
      camera: { ...defaultTerrainCameraSettings },
      rotating: false,
      rotationSeconds: defaultRotationSeconds,
      rotationDirection: 'counterclockwise',
    },
    model: {
      dimensions: { ...defaultTerrainModelSettings },
      crop: { ...defaultTerrainCrop },
      exaggeration: 0.3,
      autoExaggeration: true,
    },
    workspace: {
      view: '2d',
      activating: false,
      collapsed: false,
      sections: { '2d': 'Terrain', '3d': 'Terrain' },
      popover: null,
      exporting: false,
    },
    seedLocked: actions.isSeedLocked,
    status: '',
    manualLink: '',
    metrics: {},
  };
  let effects: StudioEffects | undefined;
  let requestVersion = 0;
  // Procedural mode parks the last real terrain so switching back is instant.
  let autoplayTimer: ReturnType<typeof setTimeout> | undefined;
  let parked: { terrain: RealTerrain; fieldsKey: string } | undefined;
  let loadedFieldsKey = '';
  const listeners = new Set<() => void>();

  const publish = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const notify = (message: string) => {
    state = { ...state, status: message };
    publish();
  };

  const workspace = (patch: Partial<StudioState['workspace']>) => {
    state = { ...state, workspace: { ...state.workspace, ...patch } };
    publish();
  };

  const sync = () => {
    state = { ...state, design: actions.getSettings() };
    publish();
  };

  let latestFocusPickId = 0;

  const applySource = (terrain: RealTerrain | undefined, shouldTransition: boolean) => {
    const previousScene = state.scene;
    const previousLocation = state.source.terrain?.location;
    const nextLocation = terrain?.location;
    const locationChanged =
      previousLocation?.latitude !== nextLocation?.latitude ||
      previousLocation?.longitude !== nextLocation?.longitude;

    state = { ...state, source: { ...state.source, terrain } };

    if (locationChanged && state.scene.gradientSource === 'location') {
      state = { ...state, scene: applyLocationGradient(state.scene, nextLocation) };
    }

    if (locationChanged && !state.scene.customLightDirection) {
      state = {
        ...state,
        scene: {
          ...state.scene,
          lighting: {
            ...state.scene.lighting,
            direction: getSuggestedTerrainLightDirection(nextLocation?.latitude),
          },
        },
      };
    }

    if (locationChanged && state.model.autoExaggeration) {
      state = { ...state, model: applySuggestedExaggeration(state.model, terrain) };
    }

    effects?.applyTerrain(terrain, shouldTransition);

    // After applyTerrain, so the renderer can blend the new gradient into the terrain morph.
    if (state.scene !== previousScene) {
      effects?.sceneChanged(previousScene);
    }

    publish();
  };

  const controller: StudioController = {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    connect(value: StudioEffects) {
      effects = value;
    },
    sync,
    notify,
    workspace,
    dismissManualLink() {
      state = { ...state, manualLink: '' };
      publish();
    },
    design(patch: Partial<DesignSettings>) {
      const ok = actions.updateSettings({ ...state.design, ...patch });

      if (ok) {
        sync();
      }

      return ok;
    },
    newLandscape() {
      if (!state.seedLocked) {
        actions.newLandscape();
        sync();
      }
    },
    lockSeed(value: boolean) {
      state = { ...state, seedLocked: value };
      actions.lockSeed(value);
      publish();
    },
    async copyLink() {
      const url = actions.getShareUrl();
      const result = await actions.copyLink(url);

      state = { ...state, manualLink: result.ok ? '' : url };
      notify(
        result.ok
          ? 'Style link copied. Location and 3D settings are excluded.'
          : result.error.message,
      );
    },
    selectSection(section: InspectorSection) {
      if (threeDOnlySections.includes(section) && state.workspace.view === '2d') {
        return;
      }

      workspace({
        collapsed: false,
        sections: { ...state.workspace.sections, [state.workspace.view]: section },
      });
    },
    async selectView(view: StudioView) {
      if (state.workspace.activating || view === state.workspace.view) {
        return;
      }

      workspace({ activating: true, popover: null });

      try {
        await effects?.activate(view);
        workspace({ view, activating: false });
      } catch {
        workspace({ view: '2d', activating: false });
        notify('The 3D preview could not start. Your browser needs WebGL 2 support.');
      }
    },
    scene(patch: Partial<SceneSettings>, custom = false) {
      const previous = state.scene;
      const merged = { ...previous, ...patch, ...(custom ? { materialPreset: 'custom' } : {}) };
      const next =
        patch.gradientSource === 'location'
          ? applyLocationGradient(merged, state.source.terrain?.location)
          : merged;

      try {
        validateElevationGradient(next.gradient);
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Invalid gradient.');

        return;
      }

      state = { ...state, scene: next };
      effects?.sceneChanged(previous);
      publish();
    },
    material(key: string) {
      const preset = (
        terrainMaterialPresets as Partial<
          Record<string, (typeof terrainMaterialPresets)[keyof typeof terrainMaterialPresets]>
        >
      )[key];

      if (preset) {
        controller.scene({
          materialPreset: key,
          surface: true,
          landFinish: preset.landFinish,
          surfaceMatch: false,
          surfaceColor: preset.land,
          waterFinish: preset.waterFinish,
          waterMatch: false,
          waterColor: preset.water,
          waterStyle: 'solid',
        });
      }
    },
    lighting(patch: Partial<TerrainLightingSettings>) {
      controller.scene({
        lighting: { ...state.scene.lighting, ...patch },
        customLightDirection:
          patch.direction === undefined ? state.scene.customLightDirection : true,
      });
    },
    resetLighting() {
      controller.scene({
        lighting: {
          ...defaultTerrainLighting,
          direction: getSuggestedTerrainLightDirection(state.source.terrain?.location?.latitude),
        },
        customLightDirection: false,
      });
    },
    camera(patch: Partial<TerrainCameraSettings>) {
      controller.scene({ camera: { ...state.scene.camera, ...patch } });
    },
    resetCameraSettings() {
      controller.scene({ camera: { ...defaultTerrainCameraSettings } });
    },
    applyViewPreset(preset: TerrainViewPreset) {
      const { projection } = terrainViewPresets[preset];

      if (projection) {
        controller.camera({ projection });
      }

      effects?.applyViewPreset(preset);
    },
    async pickFocus() {
      const pickId = ++latestFocusPickId;

      notify('Click the terrain to set focus. Press Escape to cancel.');
      const picked = (await effects?.pickFocus()) ?? false;

      // A newer pick superseded this one and owns the status message.
      if (pickId !== latestFocusPickId) {
        return;
      }

      if (picked) {
        controller.camera({ focusFollowsTarget: false });
      }

      notify(picked ? 'Focus set.' : 'Focus unchanged.');
    },
    model(patch: Partial<StudioState['model']>) {
      const merged = { ...state.model, ...patch };
      const next =
        patch.autoExaggeration === true
          ? applySuggestedExaggeration(merged, state.source.terrain)
          : merged;

      try {
        validateTerrainModelSettings(next.dimensions);

        if (!Number.isFinite(next.exaggeration) || next.exaggeration < 0 || next.exaggeration > 1) {
          throw new Error('Height exaggeration must be between 0 and 1.');
        }
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Invalid model.');

        return false;
      }

      state = { ...state, model: next };
      effects?.modelChanged();
      publish();

      return true;
    },
    dimensions(patch: Partial<TerrainModelSettings>) {
      return controller.model({ dimensions: { ...state.model.dimensions, ...patch } });
    },
    metrics(height: number, layerHeight?: number) {
      if (state.metrics.height === height && state.metrics.layerHeight === layerHeight) {
        return;
      }

      state = { ...state, metrics: { height, layerHeight } };
      publish();
    },
    async autoplay(patch) {
      const wasEnabled = state.source.autoplay.enabled;

      controller.source({ autoplay: { ...state.source.autoplay, ...patch } });
      clearTimeout(autoplayTimer);

      if (!state.source.autoplay.enabled) {
        return;
      }

      if (!wasEnabled && state.source.selected !== 'real') {
        await controller.useCoordinates();
      }

      const scheduleNextPlace = () => {
        clearTimeout(autoplayTimer);

        // Re-read after each load: the tour may have been switched off mid-download.
        if (!state.source.autoplay.enabled) {
          return;
        }

        autoplayTimer = setTimeout(() => {
          void showNextPlace();
        }, state.source.autoplay.delaySeconds * 1000);
      };

      const showNextPlace = async () => {
        const next = getNextAutoplayPlace(state.source.place);

        controller.source({
          place: `${next.latitude},${next.longitude}`,
          latitude: next.latitude,
          longitude: next.longitude,
          spanKm: next.spanKm,
        });
        await controller.loadTerrain();
        scheduleNextPlace();
      };

      scheduleNextPlace();
    },
    source(patch: Partial<TerrainSourceState>) {
      state = { ...state, source: { ...state.source, ...patch } };
      publish();
    },
    useGenerated() {
      if (state.source.selected === 'generated') {
        return;
      }

      void controller.autoplay({ enabled: false });

      requestVersion++;

      if (state.source.terrain) {
        parked = { terrain: state.source.terrain, fieldsKey: loadedFieldsKey };
      }

      controller.source({
        selected: 'generated',
        loading: false,
        status: 'Using generated terrain.',
      });
      applySource(undefined, true);
    },
    async useCoordinates() {
      controller.selectSection('Terrain');

      // Coordinates with nothing loaded (a failed first load) retries rather than doing nothing.
      if (state.source.selected === 'real' && (state.source.terrain || state.source.loading)) {
        return;
      }

      // Location fields edited since the parked load ask for a fresh load, not a stale restore.
      if (parked?.fieldsKey !== getSourceFieldsKey(state.source)) {
        controller.source({ selected: 'real' });
        await controller.loadTerrain();

        return;
      }

      loadedFieldsKey = parked.fieldsKey;
      applySource(
        {
          ...parked.terrain,
          contourInterval: state.source.interval,
          seaLevelHatching: state.source.hatching,
        },
        true,
      );
      controller.source({ selected: 'real', status: 'Real terrain restored.' });
    },
    async loadTerrain() {
      const version = ++requestVersion;
      const source = state.source;

      controller.source({ loading: true, status: 'Downloading elevation tiles…' });

      try {
        const terrain = await loadBrowserRealTerrain(
          source.latitude,
          source.longitude,
          source.spanKm,
          source.elevationFloor,
          source.maxDepth,
        );

        if (version !== requestVersion) {
          return;
        }

        loadedFieldsKey = getSourceFieldsKey(source);
        applySource(
          {
            ...terrain,
            contourInterval: state.source.interval,
            seaLevelHatching: state.source.hatching,
          },
          true,
        );
        controller.source({
          selected: 'real',
          status: 'Real terrain loaded. Location is session-only.',
        });
      } catch (error) {
        if (version === requestVersion) {
          controller.source({
            status:
              error instanceof Error ? error.message : 'Terrain could not load. Please retry.',
          });
        }
      } finally {
        if (version === requestVersion) {
          controller.source({ loading: false });
        }
      }
    },
    interval(value: 'auto' | number) {
      try {
        validateRealContourInterval(value);
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Invalid interval.');

        return false;
      }

      controller.source({ interval: value, ...(value === 'auto' ? {} : { fixedInterval: value }) });

      if (state.source.terrain) {
        applySource({ ...state.source.terrain, contourInterval: value }, false);
      }

      return true;
    },
    hatching(value: boolean) {
      controller.source({ hatching: value });

      if (state.source.terrain) {
        applySource({ ...state.source.terrain, seaLevelHatching: value }, false);
      }
    },
    resetCamera() {
      effects?.resetCamera();
    },
    downloadStl() {
      try {
        effects?.downloadStl();
      } catch (error) {
        notify(error instanceof Error ? error.message : 'STL export failed.');
      }
    },
    async downloadStill(scale: TerrainStillScale) {
      try {
        const size = await effects?.downloadStill(scale);

        if (size) {
          notify(`Saved a ${size.width} × ${size.height} px 3D still.`);
        }
      } catch (error) {
        notify(error instanceof Error ? error.message : '3D still export failed.');
      }
    },
  };

  return controller;
}

/** Identifies the location fields a real-terrain load used; must list every input `loadTerrain` passes on. */
function getSourceFieldsKey(source: TerrainSourceState): string {
  return JSON.stringify([
    source.latitude,
    source.longitude,
    source.spanKm,
    source.elevationFloor,
    source.maxDepth,
  ]);
}

/** Unknown places (typed coordinates, generated terrain) keep the current gradient. */
function applyLocationGradient(
  scene: SceneSettings,
  location: { latitude: number; longitude: number } | undefined,
): SceneSettings {
  const preset = realTerrainPresets.find(
    (place) => place.latitude === location?.latitude && place.longitude === location.longitude,
  );

  if (!preset) {
    return scene;
  }

  const key = getLandscapeGradientKey(preset.landscape);

  return {
    ...scene,
    gradient: copyElevationGradient({
      ...scene.gradient,
      stops: landscapeGradientPresets[key].stops,
    }),
    gradientPreset: key,
  };
}

/** Follows the grouped menu order so autoplay matches what the location select shows. */
function getNextAutoplayPlace(place: string): (typeof realTerrainPresets)[number] {
  const places = realTerrainPresetGroups.flatMap((group) => group.locations);
  const index = places.findIndex(
    (candidate) => `${candidate.latitude},${candidate.longitude}` === place,
  );

  return places[(index + 1) % places.length];
}

/** Generated terrain has no real scale, so it keeps the current height. */
function applySuggestedExaggeration(
  model: StudioState['model'],
  terrain: RealTerrain | undefined,
): StudioState['model'] {
  const elevations = terrain?.elevations;

  if (!elevations || terrain.spanKm === undefined) {
    return model;
  }

  // The model spans 1.6 units of metersPerUnit, so this is the relief the model shows.
  return {
    ...model,
    exaggeration: getSuggestedExaggeration(elevations.metersPerUnit * 1.6, terrain.spanKm),
  };
}
