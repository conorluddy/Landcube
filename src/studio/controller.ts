import {
  defaultTerrainModelSettings,
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
import { terrainMaterialPresets, type LandFinish, type WaterFinish } from '../terrain-materials';
import {
  copyElevationGradient,
  elevationGradientPresets,
  validateElevationGradient,
  type ElevationGradientSettings,
} from '../terrain-elevation-gradient';
import { realTerrainPresets } from '../constants/real-terrain';
import { loadBrowserRealTerrain } from '../browser-real-terrain';
import { validateRealContourInterval } from '../real-terrain-contours';
import type { RealTerrain } from '../real-terrain';
import type { DesignSettings, ValidatedDesignSettings } from '../types/design';
import type { Result } from '../types/operations';
import type { WaterStyle } from '../terrain-3d';
import type { FloorStyle } from '../terrain-floor-styles';

export type StudioView = '2d' | '3d';
export type InspectorSection = 'Terrain' | 'Contours' | 'Colour' | 'Scene' | 'Model';
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
  ground: boolean;
  groundMatch: boolean;
  groundColor: string;
  mapGrid: boolean;
  floorStyle: FloorStyle;
  north: boolean;
  waterStyle: WaterStyle;
  waterFinish: WaterFinish;
  waterMatch: boolean;
  waterColor: string;
  waterOpacity: number;
  previewWater: boolean;
  previewWaterLevel: number;
  lighting: TerrainLightingSettings;
  customLightDirection: boolean;
  rotating: boolean;
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
}
export interface StudioState {
  design: ValidatedDesignSettings;
  source: TerrainSourceState;
  scene: SceneSettings;
  model: { dimensions: TerrainModelSettings; crop: TerrainCropSettings; exaggeration: number };
  workspace: {
    view: StudioView;
    activating: boolean;
    collapsed: boolean;
    sections: Record<StudioView, InspectorSection>;
    popover: 'Overlays' | 'Camera' | null;
    exporting: boolean;
  };
  seedLocked: boolean;
  status: string;
  manualLink: string;
  metrics: { height?: number; layerHeight?: number };
}
export interface StudioEffects {
  applyTerrain(terrain: RealTerrain | undefined): void;
  activate(view: StudioView): Promise<void>;
  sceneChanged(previous: SceneSettings): void;
  modelChanged(): void;
  resetCamera(): void;
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
  model: (patch: Partial<StudioState['model']>) => boolean;
  dimensions: (patch: Partial<TerrainModelSettings>) => boolean;
  metrics: (height: number, layerHeight?: number) => void;
  source: (patch: Partial<TerrainSourceState>) => void;
  useGenerated: () => void;
  loadTerrain: () => Promise<void>;
  interval: (value: 'auto' | number) => boolean;
  hatching: (value: boolean) => void;
  resetCamera: () => void;
  downloadStl: () => void;
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
      maxDepth: 20,
      interval: 'auto',
      fixedInterval: 25,
      hatching: true,
      loading: false,
      status: '',
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
      ground: true,
      groundMatch: false,
      groundColor: '#b4b4b4',
      mapGrid: true,
      floorStyle: 'grid',
      north: true,
      waterStyle: 'solid',
      waterFinish: natural.waterFinish,
      waterMatch: false,
      waterColor: natural.water,
      waterOpacity: 0.4,
      previewWater: false,
      previewWaterLevel: 0.4,
      lighting: { ...defaultTerrainLighting },
      customLightDirection: false,
      rotating: false,
    },
    model: {
      dimensions: { ...defaultTerrainModelSettings },
      crop: { ...defaultTerrainCrop },
      exaggeration: 0.3,
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

  const applySource = (terrain: RealTerrain | undefined) => {
    const previousLocation = state.source.terrain?.location;
    const nextLocation = terrain?.location;
    const locationChanged =
      previousLocation?.latitude !== nextLocation?.latitude ||
      previousLocation?.longitude !== nextLocation?.longitude;

    state = { ...state, source: { ...state.source, terrain } };

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

    effects?.applyTerrain(terrain);
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
      if (section === 'Model' && state.workspace.view === '2d') {
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
      const next = { ...previous, ...patch, ...(custom ? { materialPreset: 'custom' } : {}) };

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
    model(patch: Partial<StudioState['model']>) {
      const next = { ...state.model, ...patch };

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
    source(patch: Partial<TerrainSourceState>) {
      state = { ...state, source: { ...state.source, ...patch } };
      publish();
    },
    useGenerated() {
      requestVersion++;
      controller.source({
        selected: 'generated',
        loading: false,
        status: 'Using generated terrain.',
      });
      applySource(undefined);
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

        applySource({
          ...terrain,
          contourInterval: state.source.interval,
          seaLevelHatching: state.source.hatching,
        });
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
        applySource({ ...state.source.terrain, contourInterval: value });
      }

      return true;
    },
    hatching(value: boolean) {
      controller.source({ hatching: value });

      if (state.source.terrain) {
        applySource({ ...state.source.terrain, seaLevelHatching: value });
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
  };

  return controller;
}
