import { findTerrainSummits } from './summit-markers';
import { getRequiredElement } from './dom-elements';
import './landscape-studio.css';
import { designChangePriority, versionOneDesignDefaults } from './constants/design';
import { engineConfiguration } from './constants/engine';
import { operationErrorCodes } from './constants/operations';
import { designUrlDebounceMs } from './constants/sharing';
import { extractContours } from './contour-extraction';
import { applyCursorElevation } from './cursor-interaction';
import { mountDesignControls } from './design-controls';
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
import { mountExportControls } from './export/export-controls';
import { createOutputRenderer } from './export/image-export';
import { calculateContourElevations } from './landscape-composition';
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
let terrain = createTerrainSampler(settings.seed, terrainSettings);
const terrainSvgElement = getRequiredElement(document, '#terrain', SVGSVGElement);
const reducedMotionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const cursor: CursorInfluence = { x: 0, y: 0, strength: 0 };
const targetCursorInfluence: CursorInfluence = { ...cursor };
let width = innerWidth;
let height = innerHeight;
let baseHeightField = sampleTerrain(terrain, width, height, terrainSettings);
let contourElevations = calculateContourElevations(settings, engineConfiguration);
let summits: ReturnType<typeof findTerrainSummits> = [];
let contours: ReturnType<typeof extractContours> = [];
let cursorAnimationFrameIdentifier: number | undefined;
let lastCursorFrameTimeMs = 0;
let lastContourRenderTimeMs = 0;
let designUrlDebounceTimer: ReturnType<typeof setTimeout> | undefined;
let pendingChange: DesignChangeKind | undefined;
let settingsUpdateFrameIdentifier: number | undefined;

const controls = mountDesignControls({
  getSettings: () => settings,
  updateSettings,
  newLandscape: () => updateSettings({ ...settings, seed: generateRandomSeed() }),
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
const refreshExportControls = mountExportControls(
  controls.panel,
  { getSettings: () => settings, updateSettings, notify: controls.notify },
  createOutputRenderer(engineConfiguration),
);

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
      terrain = createTerrainSampler(settings.seed, terrainSettings);
      baseHeightField = sampleTerrain(terrain, width, height, terrainSettings);
    }

    if (change === 'terrain' || change === 'contours') {
      contourElevations = calculateContourElevations(settings, engineConfiguration);
    }

    if (change === 'appearance') {
      renderContoursIntoSvg(terrainSvgElement, contours, width, height, settings, summits);
    } else if (change !== 'output') {
      renderCurrentLandscape();
    }

    refreshExportControls();
  });

  return true;
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
  const field = applyCursorElevation(baseHeightField, cursor, settings);

  contours = extractContours(field, contourElevations);
  summits = findTerrainSummits(field);
  renderContoursIntoSvg(terrainSvgElement, contours, width, height, settings, summits);
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
    !settings.cursorEnabled ||
    (event.target instanceof Element && event.target.closest('.control-panel'))
  ) {
    if (targetCursorInfluence.strength !== 0) {
      releaseCursor();
    }

    return;
  }

  if (event.pointerType === 'touch' && event.buttons === 0) {
    return;
  }

  if (cursor.strength === 0) {
    cursor.x = event.clientX;
    cursor.y = event.clientY;
  }

  Object.assign(targetCursorInfluence, { x: event.clientX, y: event.clientY, strength: 1 });
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

window.addEventListener('resize', () => {
  /** Updates framing immediately and defers expensive terrain resampling. */
  terrainSvgElement.setAttribute('viewBox', `0 0 ${innerWidth} ${innerHeight}`);
  clearTimeout(viewportResizeDebounceTimer);
  viewportResizeDebounceTimer = setTimeout(() => {
    /** Resamples after viewport resizing settles to avoid repeated geometry work. */
    width = innerWidth;
    height = innerHeight;
    baseHeightField = sampleTerrain(terrain, width, height, terrainSettings);
    renderCurrentLandscape();
  }, engineConfiguration.resizeDebounceMs);
});
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
