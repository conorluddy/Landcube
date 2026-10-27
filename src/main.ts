import { cropTerrainModelField } from './terrain-model';
import type { HeightField } from './types/terrain';
import { createSeaLevelGeometry, type SeaLevelGeometry } from './sea-level';
import { createStudioTerrainView } from './studio/terrain-view';
import { createStudioController } from './studio/controller';
import { createCropPreview } from './studio/crop-preview';
import { mountStudio } from './studio/app';
import { downloadBlob } from './studio/export-panel';
import { encodeTerrainStill } from './export/still-export';
import type { RealTerrain } from './real-terrain';
import { createFloorPlace } from './floor-geo';
import { clipRoadsToCrop } from './road-ribbons';
import type { RoadPath } from './types/roads';
import { findTerrainSummits } from './summit-markers';
import { getRequiredElement } from './dom-elements';
import './landscape-studio.css';
import { designChangePriority, versionOneDesignDefaults } from './constants/design';
import { engineConfiguration } from './constants/engine';
import { operationErrorCodes } from './constants/operations';
import { designUrlDebounceMs } from './constants/sharing';
import {
  extractLandscapeContours as extractContours,
  getRealContourInterval,
} from './real-terrain-contours';
import { applyCursorElevation } from './cursor-interaction';
import {
  classifyDesignSettingChange,
  deriveTerrainConfiguration,
  parseDesignParameters,
  validateDesignSettings,
} from './design-settings';
import {
  copyDesignLink,
  loadInitialDesign,
  readLockedSeed,
  replaceDesignUrl,
  saveLockedSeed,
} from './design-sharing';
import { createOutputRenderer } from './export/image-export';
import { calculateContourElevations, getTerrainTerraceLevels } from './landscape-composition';
import { logOperationError } from './operation-logging';
import { renderContoursIntoSvg } from './svg-rendering';
import { createTerrainSampler, sampleTerrain } from './terrain-generation';
import type { CursorInfluence } from './types/cursor';
import type { DesignChangeKind, DesignSettings } from './types/design';
import type { Result } from './types/operations';

const millisecondsPerSecond = 1000;
const maximumCursorFrameElapsedMs = 100;
const cursorPositionSettlingTolerancePixels = 0.5;
const cursorStrengthSettlingTolerance = 0.002;

/** Restores startup settings before sampling the first landscape. */
const startupStartedAtMs = performance.now();
/** Uses browser randomness for a fresh unsigned landscape seed. */
const generateRandomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
let storedSeedResult: Result<number | null>;

try {
  storedSeedResult = readLockedSeed(localStorage);
} catch {
  storedSeedResult = {
    ok: false,
    error: {
      code: operationErrorCodes.storageFailed,
      message: 'Browser storage is unavailable. Use Copy link to save this design.',
      retryable: true,
    },
  };
}

const initialDesignResult = loadInitialDesign(
  new URLSearchParams(location.search),
  { width: innerWidth, height: innerHeight },
  generateRandomSeed(),
  storedSeedResult.ok ? storedSeedResult.data : null,
);
const fallbackDesignResult = parseDesignParameters(new URLSearchParams(), versionOneDesignDefaults);

if (!fallbackDesignResult.ok) {
  throw new Error('Invalid built-in settings');
}

let settings = initialDesignResult.ok
  ? initialDesignResult.data.settings
  : fallbackDesignResult.data.settings;
let terrainSettings = deriveTerrainConfiguration(settings, engineConfiguration);
let realTerrain: RealTerrain | undefined;
let terrain = createTerrainSampler(settings.seed, terrainSettings);
const terrainSvgElement = getRequiredElement(document, '#terrain', SVGSVGElement);
const reducedMotionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const cursor: CursorInfluence = { x: 0, y: 0, strength: 0 };
const targetCursorInfluence: CursorInfluence = { ...cursor };
let width = innerWidth;
let height = innerHeight;
let baseHeightField = sampleTerrain(terrain, width, height, terrainSettings);
let contourElevations = calculateContourElevations(settings, engineConfiguration, realTerrain);
let summits: ReturnType<typeof findTerrainSummits> = [];
let contours: ReturnType<typeof extractContours> = [];
let seaLevel: SeaLevelGeometry | undefined;
let cursorAnimationFrameIdentifier: number | undefined;
let lastCursorFrameTimeMs = 0;
let lastContourRenderTimeMs = 0;
let designUrlDebounceTimer: ReturnType<typeof setTimeout> | undefined;
let pendingChange: DesignChangeKind | undefined;
let settingsUpdateFrameIdentifier: number | undefined;

const controls = createStudioController({
  getSettings: () => settings,
  updateSettings,
  newLandscape: () => {
    if (!realTerrain) {
      requestTerrainTransition();
    }

    updateSettings({ ...settings, seed: generateRandomSeed() });
  },
  isSeedLocked: storedSeedResult.ok && storedSeedResult.data === settings.seed,
  lockSeed: (isLocked) => {
    try {
      const result = saveLockedSeed(localStorage, isLocked ? settings.seed : null);

      if (!result.ok) {
        logOperationError(result.error);
        controls.notify(result.error.message);
      }
    } catch {
      controls.notify('Browser storage is unavailable. Use Copy link to save this design.');
      logOperationError({
        code: operationErrorCodes.storageFailed,
        message: 'Browser storage access failed',
        retryable: true,
      });
    }
  },
  getShareUrl: synchronizeDesignUrl,
  copyLink: (url) => copyDesignLink(url, navigator.clipboard),
});
const outputRenderer = createOutputRenderer(engineConfiguration, () => realTerrain);
const cropPreview = createCropPreview(controls);
const terrain3d = createStudioTerrainView(controls, () => {
  cursor.strength = targetCursorInfluence.strength = 0;
  renderCurrentLandscape();
});

controls.connect({
  activate: terrain3d.activate,
  sceneChanged: terrain3d.sceneChanged,
  modelChanged: terrain3d.modelChanged,
  resetCamera: terrain3d.resetCamera,
  applyViewPreset: terrain3d.applyViewPreset,
  pickFocus: terrain3d.pickFocus,
  async downloadStill(scale) {
    const frame = terrain3d.captureStill(scale);

    downloadBlob(
      await encodeTerrainStill(frame, getStillAttribution()),
      `topogra-${settings.seed}-3d-${scale}x.png`,
    );

    return { width: frame.width, height: frame.height };
  },
  downloadStl: () => {
    const model = controls.getSnapshot().model.dimensions;

    downloadBlob(
      new Blob([terrain3d.getStl()], { type: 'model/stl' }),
      model.cropShape === 'circle'
        ? `topogra-${settings.seed}-circle-${model.widthMm}mm.stl`
        : `topogra-${settings.seed}-${model.widthMm}x${model.lengthMm}mm.stl`,
    );
  },
  roadsChanged: updateTerrain3d,
  applyTerrain: (loadedTerrain, shouldTransition) => {
    if (shouldTransition) {
      requestTerrainTransition();
    }

    realTerrain = loadedTerrain;
    contourElevations = calculateContourElevations(settings, engineConfiguration, realTerrain);
    terrain = realTerrain
      ? (x, y) => sampleLoadedTerrain(x, y)
      : createTerrainSampler(settings.seed, terrainSettings);
    cursor.strength = targetCursorInfluence.strength = 0;
    baseHeightField = sampleTerrain(terrain, width, height, terrainSettings);
    renderCurrentLandscape();
  },
});

if (!storedSeedResult.ok) {
  logOperationError(storedSeedResult.error);
  controls.notify(storedSeedResult.error.message);
}

if (!initialDesignResult.ok) {
  logOperationError(initialDesignResult.error);
  controls.notify(initialDesignResult.error.message);
} else if (initialDesignResult.data.warnings.length) {
  const message = `Unsupported values for ${initialDesignResult.data.warnings.join(', ')} were reset to defaults.`;

  logOperationError({ code: operationErrorCodes.invalidSettings, message, retryable: true });
  controls.notify(message);
}

/** Commits a validated edit and batches the required rendering work. */
function updateSettings(nextDesignSettings: DesignSettings): boolean {
  const result = validateDesignSettings(nextDesignSettings);

  if (!result.ok) {
    logOperationError(result.error);
    controls.notify(result.error.message);

    return false;
  }

  const changed = (Object.keys(nextDesignSettings) as (keyof DesignSettings)[]).filter(
    (key) => nextDesignSettings[key] !== settings[key],
  );

  settings = result.data;

  for (const key of changed) {
    const kind = classifyDesignSettingChange(key);

    if (!pendingChange || designChangePriority[kind] > designChangePriority[pendingChange]) {
      pendingChange = kind;
    }
  }

  clearTimeout(designUrlDebounceTimer);
  designUrlDebounceTimer = setTimeout(synchronizeDesignUrl, designUrlDebounceMs);

  if (settingsUpdateFrameIdentifier !== undefined || !pendingChange) {
    return true;
  }

  settingsUpdateFrameIdentifier = requestAnimationFrame(() => {
    /** Batches edits so each frame performs only the most expensive required refresh. */
    settingsUpdateFrameIdentifier = undefined;
    const change = pendingChange;

    pendingChange = undefined;
    applyPageStyle();

    if (!settings.cursorEnabled) {
      cursor.strength = targetCursorInfluence.strength = 0;
    }

    if (change === 'terrain') {
      terrainSettings = deriveTerrainConfiguration(settings, engineConfiguration);
      terrain = realTerrain
        ? (x, y) => sampleLoadedTerrain(x, y)
        : createTerrainSampler(settings.seed, terrainSettings);
      baseHeightField = sampleTerrain(terrain, width, height, terrainSettings);
    }

    if (change === 'terrain' || change === 'contours') {
      contourElevations = calculateContourElevations(settings, engineConfiguration, realTerrain);
    }

    if (change === 'appearance') {
      updateTerrain3d();
      renderContoursIntoSvg(
        terrainSvgElement,
        contours,
        width,
        height,
        settings,
        summits,
        seaLevel,
      );
    } else if (change !== 'output') {
      renderCurrentLandscape();
    }

    controls.sync();
  });

  return true;
}

/** Arms a 3D landscape morph for the next rebuild; reduced motion always cuts. */
function requestTerrainTransition(): void {
  if (!reducedMotionPreference.matches) {
    terrain3d.requestTransition();
  }
}

/** Flushes pending edits into the current share URL. */
function synchronizeDesignUrl(): string {
  clearTimeout(designUrlDebounceTimer);

  return replaceDesignUrl(location.href, settings, history);
}

/** Keeps the page backdrop and browser theme aligned with the design. */
function applyPageStyle(): void {
  document.documentElement.style.backgroundColor = settings.background;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.background);
}

/** Renders the current cursor influence over cached base terrain. */
function renderCurrentLandscape(): void {
  const field =
    realTerrain || terrain3d.isActive()
      ? baseHeightField
      : applyCursorElevation(baseHeightField, cursor, settings);

  contours = extractContours(field, contourElevations, realTerrain);
  summits = findTerrainSummits(field);
  seaLevel = createSeaLevelGeometry(field, width, height, realTerrain);
  updateTerrain3d();
  renderContoursIntoSvg(terrainSvgElement, contours, width, height, settings, summits, seaLevel);
}

// The source frame is captured once; viewport resizes never change printable terrain.
let modelSourceFrame: { width: number; height: number } | undefined;
let modelSourceSampler: typeof terrain | undefined;
let modelSourceField: HeightField | undefined;
let modelCropKey = '';
let modelCrop: ReturnType<typeof cropTerrainModelField> | undefined;
let roadPaths: { key: unknown[]; paths: RoadPath[] } = { key: [], paths: [] };

function updateTerrain3d(): void {
  if (!terrain3d.isActive()) {
    return;
  }

  modelSourceFrame ??= { width, height };

  if (modelSourceSampler !== terrain || !modelSourceField) {
    const frame = modelSourceFrame;
    const loaded = realTerrain;
    const sampler = loaded
      ? (x: number, y: number) => loaded.sample(x, y, frame.width, frame.height)
      : terrain;

    modelSourceField = sampleTerrain(sampler, frame.width, frame.height, terrainSettings);
    modelSourceSampler = terrain;
    modelCrop = undefined;
  }

  cropPreview.update(
    modelSourceField,
    modelSourceFrame.width,
    modelSourceFrame.height,
    settings,
    realTerrain ? contourElevations : undefined,
  );
  const dimensions = controls.getSnapshot().model.dimensions;
  const crop = controls.getSnapshot().model.crop;
  const key = JSON.stringify([dimensions.widthMm, dimensions.lengthMm, dimensions.cropShape, crop]);

  if (!modelCrop || key !== modelCropKey) {
    modelCrop = cropTerrainModelField(
      modelSourceField,
      modelSourceFrame.width,
      modelSourceFrame.height,
      dimensions,
      crop,
    );
    modelCropKey = key;
  }

  const croppedContours = extractContours(modelCrop.field, contourElevations, realTerrain);
  const croppedSea = createSeaLevelGeometry(
    modelCrop.field,
    modelCrop.width,
    modelCrop.height,
    realTerrain,
  );

  terrain3d.update(
    croppedContours,
    modelCrop.width,
    modelCrop.height,
    settings,
    modelCrop.field,
    croppedSea,
    realTerrain?.attribution,
    createFloorPlace(realTerrain, modelCrop, modelSourceFrame),
    getRealContourInterval(realTerrain),
    getTerrainTerraceLevels(settings, engineConfiguration, realTerrain),
    getCroppedRoadPaths(modelSourceFrame, modelCrop, dimensions.cropShape ?? 'rectangle'),
  );
}

/** Projects the current road network into the model crop, reusing the last result when unchanged. */
function getCroppedRoadPaths(
  frame: { width: number; height: number },
  crop: NonNullable<typeof modelCrop>,
  shape: 'rectangle' | 'circle',
): RoadPath[] {
  const { roads } = controls.getSnapshot();
  const location = realTerrain?.location;
  const spanKm = realTerrain?.spanKm;

  // Disabled roads still project, so switching them back on needs no terrain update.
  if (!roads.network || !location || spanKm === undefined) {
    return [];
  }

  const key = [roads.network, location, spanKm, frame, crop, shape];

  if (key.some((value, index) => value !== roadPaths.key[index])) {
    roadPaths = {
      key,
      paths: clipRoadsToCrop(roads.network.roads, { location, spanKm }, frame, crop, shape),
    };
  }

  return roadPaths.paths;
}

/** Credits every external source visible in the 3D view. */
function getStillAttribution(): string | undefined {
  const { roads, scene } = controls.getSnapshot();
  const credits = [
    realTerrain?.attribution,
    scene.roads.enabled ? roads.network?.attribution : undefined,
  ].filter((credit) => credit !== undefined && credit !== '');

  return credits.length > 0 ? credits.join(' · ') : undefined;
}

/** Eases cursor deformation with capped frame pacing until settled. */
function animateCursorInfluence(time: number): void {
  cursorAnimationFrameIdentifier = undefined;

  if (document.hidden) {
    return;
  }

  if (time - lastContourRenderTimeMs < millisecondsPerSecond / engineConfiguration.cursorMaxFps) {
    cursorAnimationFrameIdentifier = requestAnimationFrame(animateCursorInfluence);

    return;
  }

  const elapsedFrameTimeMs = lastCursorFrameTimeMs
    ? Math.min(time - lastCursorFrameTimeMs, maximumCursorFrameElapsedMs)
    : millisecondsPerSecond / engineConfiguration.cursorMaxFps;

  lastCursorFrameTimeMs = time;
  lastContourRenderTimeMs = time;
  const cursorInterpolationWeight = reducedMotionPreference.matches
    ? 1
    : 1 - Math.exp(-elapsedFrameTimeMs / settings.cursorResponseMs);

  cursor.x += (targetCursorInfluence.x - cursor.x) * cursorInterpolationWeight;
  cursor.y += (targetCursorInfluence.y - cursor.y) * cursorInterpolationWeight;
  cursor.strength += (targetCursorInfluence.strength - cursor.strength) * cursorInterpolationWeight;
  const isSettled =
    Math.abs(targetCursorInfluence.x - cursor.x) < cursorPositionSettlingTolerancePixels &&
    Math.abs(targetCursorInfluence.y - cursor.y) < cursorPositionSettlingTolerancePixels &&
    Math.abs(targetCursorInfluence.strength - cursor.strength) < cursorStrengthSettlingTolerance;

  if (isSettled) {
    Object.assign(cursor, targetCursorInfluence);
  }

  renderCurrentLandscape();

  if (!isSettled) {
    cursorAnimationFrameIdentifier = requestAnimationFrame(animateCursorInfluence);
  }
}

/** Starts a single animation loop when the page can render. */
function scheduleCursorAnimation(): void {
  if (cursorAnimationFrameIdentifier !== undefined || document.hidden) {
    return;
  }

  lastCursorFrameTimeMs = 0;
  cursorAnimationFrameIdentifier = requestAnimationFrame(animateCursorInfluence);
}

/** Tracks eligible pointers while keeping control interaction deformation-free. */
function moveCursor(event: PointerEvent): void {
  if (
    terrain3d.isActive() ||
    realTerrain !== undefined ||
    !settings.cursorEnabled ||
    (event.target instanceof Element && event.target.closest('header, aside, footer, dialog'))
  ) {
    if (targetCursorInfluence.strength !== 0) {
      releaseCursor();
    }

    return;
  }

  if (event.pointerType === 'touch' && event.buttons === 0) {
    return;
  }

  const bounds = terrainSvgElement.getBoundingClientRect();
  const x = event.clientX - bounds.left;
  const y = event.clientY - bounds.top;

  if (cursor.strength === 0) {
    cursor.x = x;
    cursor.y = y;
  }

  Object.assign(targetCursorInfluence, { x, y, strength: 1 });
  scheduleCursorAnimation();
}

/** Lets the cursor hill settle back into the base terrain. */
function releaseCursor(): void {
  Object.assign(targetCursorInfluence, { x: cursor.x, y: cursor.y, strength: 0 });
  scheduleCursorAnimation();
}

/** Connects pointer and page lifecycle events to rendering and URL synchronization. */
window.addEventListener('pointermove', moveCursor, { passive: true });
window.addEventListener('pointerdown', moveCursor, { passive: true });
window.addEventListener('pointerup', (event) => {
  if (event.pointerType === 'touch') {
    releaseCursor();
  }
});
window.addEventListener('pointercancel', releaseCursor);
document.documentElement.addEventListener('pointerleave', releaseCursor);
window.addEventListener('blur', releaseCursor);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (cursorAnimationFrameIdentifier !== undefined) {
      cancelAnimationFrame(cursorAnimationFrameIdentifier);
    }

    cursorAnimationFrameIdentifier = undefined;
    cursor.strength = targetCursorInfluence.strength = 0;
    synchronizeDesignUrl();
  } else {
    scheduleCursorAnimation();
  }
});
window.addEventListener('pagehide', synchronizeDesignUrl);
window.addEventListener('popstate', () => {
  /** Restores design state when browser navigation changes the shared URL. */
  const result = parseDesignParameters(new URLSearchParams(location.search));

  if (!result.ok) {
    controls.notify(result.error.message);
    logOperationError(result.error);

    return;
  }

  updateSettings(result.data.settings);
  controls.sync();
});
let viewportResizeDebounceTimer: ReturnType<typeof setTimeout>;

mountStudio(controls, terrainSvgElement, outputRenderer, cropPreview);
const viewport = getRequiredElement(document, '#studio-viewport', HTMLElement);

const resizeViewport = () => {
  const nextWidth = Math.max(1, viewport.clientWidth);
  const nextHeight = Math.max(1, viewport.clientHeight);

  terrainSvgElement.setAttribute('viewBox', `0 0 ${nextWidth} ${nextHeight}`);
  clearTimeout(viewportResizeDebounceTimer);
  viewportResizeDebounceTimer = setTimeout(() => {
    width = nextWidth;
    height = nextHeight;
    baseHeightField = sampleTerrain(terrain, width, height, terrainSettings);
    renderCurrentLandscape();
  }, engineConfiguration.resizeDebounceMs);
};

new ResizeObserver(resizeViewport).observe(viewport);
width = Math.max(1, viewport.clientWidth);
height = Math.max(1, viewport.clientHeight);
baseHeightField = sampleTerrain(terrain, width, height, terrainSettings);
applyPageStyle();
synchronizeDesignUrl();
renderCurrentLandscape();
requestAnimationFrame(() => {
  console.info(
    JSON.stringify({
      event: 'landscape_ready',
      seed: settings.seed,
      width,
      height,
      samples: baseHeightField.values.length,
      duration_ms: Number((performance.now() - startupStartedAtMs).toFixed(1)),
    }),
  );
});

/** Keeps the active geographic patch centered as the viewport changes. */
function sampleLoadedTerrain(x: number, y: number): number {
  if (!realTerrain) {
    throw new Error('Real terrain is unavailable.');
  }

  return realTerrain.sample(x, y, width, height);
}
