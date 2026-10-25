#!/usr/bin/env node

// src/cli.ts
import { randomBytes } from 'node:crypto';
import { readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

// src/constants/design.ts
var designUrlVersion = '1';
var maximumSeedValue = 4294967295;
var minimumOutputDimensionPixels = 64;
var maximumOutputDimensionPixels = 4096;
var maximumExtraLargeOutputDimensionPixels = 12288;
var numericStepTolerance = 1e-6;
var summitMarkerSizes = ['S', 'M', 'L'];
var summitMarkerSizeScales = { S: 1, M: 1.5, L: 2 };
var indexContourStyles = ['dashed', 'solid', 'alternating', 'off'];
var imageExportFormats = ['svg', 'png'];
var versionOneDesignDefaults = Object.freeze({
  seed: 0,
  gridStyle: 'off',
  gridSpacing: 80,
  gridOpacity: 0.15,
  background: '#202326',
  lineColor: '#a4adb0',
  strokeWidth: 0.85,
  strokeOpacity: 0.29,
  contourCount: 23,
  featureScale: 260,
  detail: 0.32,
  indexStyle: 'dashed',
  indexEvery: 10,
  indexStrokeWidth: 0.85,
  dashLength: 7,
  dashGap: 5,
  summitMarkerSize: 'S',
  summitTrianglesEnabled: false,
  summitCrossesEnabled: false,
  cursorEnabled: true,
  cursorRadius: 190,
  cursorHeight: 0.32,
  cursorResponseMs: 120,
  format: 'svg',
  width: 1440,
  height: 900,
  pngScale: 1,
  transparent: false,
  allowExtraLargeExports: false,
});
var designNumberConstraints = {
  seed: [0, maximumSeedValue, 1],
  gridSpacing: [20, 240, 10],
  gridOpacity: [0.05, 1, 0.01],
  strokeWidth: [0.3, 3, 0.05],
  strokeOpacity: [0.05, 1, 0.01],
  contourCount: [7, 49, 2],
  featureScale: [120, 700, 10],
  detail: [0, 1, 0.01],
  indexEvery: [1, 15, 1],
  indexStrokeWidth: [0.3, 4, 0.05],
  dashLength: [1, 24, 1],
  dashGap: [1, 20, 1],
  cursorRadius: [60, 400, 10],
  cursorHeight: [-0.6, 0.6, 0.02],
  cursorResponseMs: [20, 3e3, 10],
  width: [minimumOutputDimensionPixels, maximumExtraLargeOutputDimensionPixels, 1],
  height: [minimumOutputDimensionPixels, maximumExtraLargeOutputDimensionPixels, 1],
};

// src/constants/engine.ts
var engineConfiguration = Object.freeze({
  sampleSpacing: 5,
  overscan: 60,
  maxSamples: 45e4,
  elevationMin: -0.72,
  elevationMax: 0.72,
  resizeDebounceMs: 100,
  cursorMaxFps: 30,
});

// src/constants/export.ts
var imageMimeTypes = { svg: 'image/svg+xml', png: 'image/png' };
var outputSizePresetGroups = [
  {
    label: 'General',
    presets: [
      { value: '1920x1080', label: 'Landscape \xB7 1920 \xD7 1080' },
      { value: '1080x1080', label: 'Square \xB7 1080 \xD7 1080' },
      { value: '1080x1920', label: 'Portrait \xB7 1080 \xD7 1920' },
    ],
  },
  {
    label: 'Paper \xB7 150 DPI',
    presets: [
      { value: '874x1240', label: 'A5 \xB7 874 \xD7 1240' },
      { value: '1240x1754', label: 'A4 \xB7 1240 \xD7 1754' },
      { value: '1754x2480', label: 'A3 \xB7 1754 \xD7 2480' },
      { value: '2480x3508', label: 'A2 \xB7 2480 \xD7 3508' },
      { value: '1275x1650', label: 'US Letter \xB7 1275 \xD7 1650' },
      { value: '1275x2100', label: 'US Legal \xB7 1275 \xD7 2100' },
      { value: '1650x2550', label: 'US Tabloid \xB7 1650 \xD7 2550' },
    ],
  },
  {
    label: 'Phones',
    presets: [
      { value: '1080x2340', label: 'Phone \xB7 1080 \xD7 2340' },
      { value: '1080x2400', label: 'Phone \xB7 1080 \xD7 2400' },
      { value: '1170x2532', label: 'Phone \xB7 1170 \xD7 2532' },
      { value: '1179x2556', label: 'Phone \xB7 1179 \xD7 2556' },
      { value: '1290x2796', label: 'Phone \xB7 1290 \xD7 2796' },
      { value: '1440x3120', label: 'Phone \xB7 1440 \xD7 3120' },
    ],
  },
  {
    label: 'Desktop monitors',
    presets: [
      { value: '1366x768', label: 'HD \xB7 1366 \xD7 768' },
      { value: '1920x1200', label: 'WUXGA \xB7 1920 \xD7 1200' },
      { value: '2560x1440', label: 'QHD \xB7 2560 \xD7 1440' },
      { value: '2560x1600', label: '16:10 \xB7 2560 \xD7 1600' },
      { value: '3440x1440', label: 'Ultrawide \xB7 3440 \xD7 1440' },
      { value: '3840x2160', label: '4K UHD \xB7 3840 \xD7 2160' },
    ],
  },
];

// src/constants/palettes.ts
var designPalettePresets = {
  Charcoal: {
    background: versionOneDesignDefaults.background,
    lineColor: versionOneDesignDefaults.lineColor,
    strokeOpacity: versionOneDesignDefaults.strokeOpacity,
    strokeWidth: versionOneDesignDefaults.strokeWidth,
    indexStrokeWidth: versionOneDesignDefaults.indexStrokeWidth,
  },
  Paper: {
    background: '#eee9dd',
    lineColor: '#716c5e',
    strokeOpacity: 0.45,
    strokeWidth: 0.8,
    indexStrokeWidth: 1.2,
  },
  Blueprint: {
    background: '#153c68',
    lineColor: '#b9dbf5',
    strokeOpacity: 0.55,
    strokeWidth: 0.8,
    indexStrokeWidth: 1.3,
  },
  Bold: {
    background: '#151816',
    lineColor: '#c2dc8a',
    strokeOpacity: 0.8,
    strokeWidth: 1.5,
    indexStrokeWidth: 2.4,
  },
};

// src/constants/real-terrain.ts
var realTerrainBounds = {
  minimumLatitude: -85,
  maximumLatitude: 85,
  minimumLongitude: -180,
  maximumLongitude: 180,
  minimumSpanKm: 2,
  maximumSpanKm: 200,
  defaultSpanKm: 25,
};
var realTerrainPresets = [
  { name: 'Wicklow Mountains', latitude: 53.01, longitude: -6.33 },
  { name: 'Dublin', latitude: 53.3498, longitude: -6.2603 },
  { name: 'Cork', latitude: 51.8985, longitude: -8.4756 },
  { name: 'Galway', latitude: 53.2707, longitude: -9.0568 },
  { name: 'Kilkee', latitude: 52.6795, longitude: -9.647 },
  { name: 'Mont Blanc', latitude: 45.83, longitude: 6.86 },
  { name: 'Everest', latitude: 27.99, longitude: 86.93 },
  { name: 'Mount Fuji', latitude: 35.3606, longitude: 138.7274 },
  { name: 'Mount Aso', latitude: 32.8842, longitude: 131.104 },
  { name: 'Japanese Alps \u2014 Kamik\u014Dchi', latitude: 36.2492, longitude: 137.6377 },
  { name: 'Aoraki / Mount Cook', latitude: -43.595, longitude: 170.1418 },
  { name: 'Milford Sound', latitude: -44.6414, longitude: 167.8975 },
  { name: 'Machu Picchu', latitude: -13.1631, longitude: -72.545 },
  { name: 'Cordillera Blanca \u2014 Huascar\xE1n', latitude: -9.1214, longitude: -77.6044 },
  { name: 'Serra dos \xD3rg\xE3os', latitude: -22.4575, longitude: -43.0306 },
  { name: 'Rio de Janeiro \u2014 Tijuca', latitude: -22.9628, longitude: -43.2792 },
  { name: 'Dolomites \u2014 Tre Cime', latitude: 46.6186, longitude: 12.3026 },
  { name: 'Matterhorn', latitude: 45.9763, longitude: 7.6586 },
  { name: 'Torres del Paine', latitude: -50.9423, longitude: -73.4068 },
  { name: 'Mount Kilimanjaro', latitude: -3.0674, longitude: 37.3556 },
];

// src/constants/operations.ts
var operationErrorCodes = {
  invalidSettings: 'INVALID_SETTINGS',
  unsupportedVersion: 'UNSUPPORTED_VERSION',
  storageFailed: 'STORAGE_FAILED',
  urlFailed: 'URL_FAILED',
  clipboardFailed: 'CLIPBOARD_FAILED',
  exportFailed: 'EXPORT_FAILED',
};

// src/constants/terrain.ts
var seededRandomIncrement = 1831565813;
var unsignedIntegerRange = 4294967296;
var noisePermutationSize = 256;
var noisePermutationMask = noisePermutationSize - 1;
var noiseGradientCount = 16;
var noiseGradients = Array.from({ length: noiseGradientCount }, (_, gradientIndex) => {
  const gradientAngleRadians = (gradientIndex * Math.PI) / (noiseGradientCount / 2);
  return [Math.cos(gradientAngleRadians), Math.sin(gradientAngleRadians)];
});
var terrainOffsetSeedMask = 2654435769;
var terrainNoiseOffsetRange = 100;
var terrainRotationRadians = 0.39;
var detailNoiseOctaves = [
  { frequency: 2, amplitude: 0.75 },
  { frequency: 4, amplitude: 0.25 },
];

// src/design-settings.ts
function parseDesignParameters(parameters, defaults = versionOneDesignDefaults) {
  const version = parameters.get('v');
  if (version !== null && version !== designUrlVersion) {
    return {
      ok: false,
      error: {
        code: operationErrorCodes.unsupportedVersion,
        message: `Design version ${version.slice(0, 20)} is unsupported. Open a v=1 link or use the current defaults.`,
        retryable: false,
      },
    };
  }
  const settings = { ...defaults };
  const warnings = [];
  for (const key of Object.keys(versionOneDesignDefaults)) {
    const serializedValue = parameters.get(key);
    if (serializedValue === null) {
      continue;
    }
    const value = parseDesignSettingValue(key, serializedValue);
    if (value === void 0) {
      warnings.push(key);
    } else {
      Object.assign(settings, { [key]: value });
    }
  }
  for (const key of ['width', 'height']) {
    if (!settings.allowExtraLargeExports && settings[key] > maximumOutputDimensionPixels) {
      settings[key] = defaults[key];
      warnings.push(key);
    }
  }
  return {
    ok: true,
    data: { settings: Object.freeze(settings), warnings },
  };
}
function validateDesignSettings(settings) {
  const result = parseDesignParameters(serializeDesignParameters(settings));
  if (!result.ok) {
    return result;
  }
  if (result.data.warnings.length) {
    return {
      ok: false,
      error: {
        code: operationErrorCodes.invalidSettings,
        message: `Invalid ${result.data.warnings.join(', ')}. Use the supported ranges shown in the controls.`,
        retryable: true,
      },
    };
  }
  return { ok: true, data: result.data.settings };
}
function serializeDesignParameters(settings) {
  const parameters = new URLSearchParams({ v: designUrlVersion });
  for (const key of Object.keys(versionOneDesignDefaults)) {
    parameters.set(key, String(settings[key]));
  }
  return parameters;
}
function getDesignUrl(baseUrl, settings) {
  const url = new URL(baseUrl);
  url.search = serializeDesignParameters(settings).toString();
  return url.href;
}
function deriveTerrainConfiguration(settings, engineConfiguration2) {
  return {
    ...engineConfiguration2,
    featureScale: settings.featureScale,
    noiseOctaves: [
      { frequency: 1, amplitude: 1 - settings.detail },
      ...detailNoiseOctaves.map((octave) => ({
        frequency: octave.frequency,
        amplitude: settings.detail * octave.amplitude,
      })),
    ],
  };
}
function parseDesignSettingValue(key, serializedValue) {
  if (key in designNumberConstraints) {
    if (!/^-?\d+(\.\d+)?$/.test(serializedValue)) {
      return void 0;
    }
    const value = Number(serializedValue);
    const [minimumValue, maximumValue, stepSize] = designNumberConstraints[key];
    if (
      !Number.isFinite(value) ||
      value < minimumValue ||
      value > maximumValue ||
      Math.abs((value - minimumValue) / stepSize - Math.round((value - minimumValue) / stepSize)) >
        numericStepTolerance
    ) {
      return void 0;
    }
    return value;
  }
  if (key === 'background' || key === 'lineColor') {
    return /^#[0-9a-f]{6}$/i.test(serializedValue) ? serializedValue.toLowerCase() : void 0;
  }
  if (
    key === 'summitTrianglesEnabled' ||
    key === 'summitCrossesEnabled' ||
    key === 'cursorEnabled' ||
    key === 'transparent' ||
    key === 'allowExtraLargeExports'
  ) {
    return serializedValue === 'true' ? true : serializedValue === 'false' ? false : void 0;
  }
  if (key === 'gridStyle') {
    return ['off', 'squares', 'crosses'].includes(serializedValue) ? serializedValue : void 0;
  }
  if (key === 'summitMarkerSize') {
    return summitMarkerSizes.some((size) => size === serializedValue) ? serializedValue : void 0;
  }
  if (key === 'indexStyle') {
    return indexContourStyles.some((style) => style === serializedValue) ? serializedValue : void 0;
  }
  if (key === 'format') {
    return imageExportFormats.some((format) => format === serializedValue)
      ? serializedValue
      : void 0;
  }
  if (key === 'pngScale') {
    return serializedValue === '1' ? 1 : serializedValue === '2' ? 2 : void 0;
  }
  return void 0;
}

// src/summit-markers.ts
var minimumSummitSeparationPixels = 40;
function findTerrainSummits(field) {
  const { columns, rows, values, originX, originY, spacing } = field;
  const candidates = [];
  for (let row = 1; row < rows - 1; row++) {
    for (let column = 1; column < columns - 1; column++) {
      const elevation = values[row * columns + column];
      if (elevation <= 0) {
        continue;
      }
      let isSummit = true;
      for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
        for (let columnOffset = -1; columnOffset <= 1; columnOffset++) {
          if (rowOffset === 0 && columnOffset === 0) {
            continue;
          }
          if (values[(row + rowOffset) * columns + column + columnOffset] >= elevation) {
            isSummit = false;
          }
        }
      }
      if (isSummit) {
        candidates.push({ x: originX + column * spacing, y: originY + row * spacing, elevation });
      }
    }
  }
  const summits = [];
  for (const candidate of candidates.sort((first, second) => second.elevation - first.elevation)) {
    if (
      summits.every(
        (summit) =>
          Math.hypot(candidate.x - summit.x, candidate.y - summit.y) >=
          minimumSummitSeparationPixels,
      )
    ) {
      summits.push({ x: candidate.x, y: candidate.y });
    }
  }
  return summits;
}
function createSummitMarkerMarkup(summits, settings) {
  if (!settings.summitTrianglesEnabled && !settings.summitCrossesEnabled) {
    return '';
  }
  const scale = summitMarkerSizeScales[settings.summitMarkerSize];
  const triangle = settings.summitTrianglesEnabled ? '<path d="M0,-7L6,4L-6,4Z"/>' : '';
  const cross = settings.summitCrossesEnabled ? '<path d="M-2.5,0H2.5M0,-2.5V2.5"/>' : '';
  return `<g data-summit-markers="" fill="none" stroke="${settings.lineColor}" stroke-width="${settings.strokeWidth}" stroke-opacity="${settings.strokeOpacity}" stroke-linecap="round" stroke-linejoin="round">${summits.map(({ x, y }) => `<g transform="translate(${x},${y}) scale(${scale})">${triangle}${cross}</g>`).join('')}</g>`;
}

// src/contour-extraction.ts
var contourVertexTieBreakElevation = 1e-12;
function extractContourAtElevation(field, elevation) {
  const { columns, rows, values, spacing, originX, originY } = field;
  const points = /* @__PURE__ */ new Map();
  const neighbors = /* @__PURE__ */ new Map();
  const horizontalEdgeCount = (columns - 1) * rows;
  const getHorizontalEdgeIdentifier = (x, y) => y * (columns - 1) + x;
  const getVerticalEdgeIdentifier = (x, y) => horizontalEdgeCount + y * columns + x;
  const calculateRelativeElevation = (value) =>
    value === elevation ? contourVertexTieBreakElevation : value - elevation;
  const ensureInterpolatedEdgePoint = (
    id,
    x,
    y,
    edgeDirectionX,
    edgeDirectionY,
    startElevation,
    endElevation,
  ) => {
    if (!points.has(id)) {
      const interpolationFraction = startElevation / (startElevation - endElevation);
      points.set(id, {
        x: originX + (x + edgeDirectionX * interpolationFraction) * spacing,
        y: originY + (y + edgeDirectionY * interpolationFraction) * spacing,
      });
    }
  };
  const connectContourEdges = (firstEdgeIdentifier, secondEdgeIdentifier) => {
    for (const [from, to] of [
      [firstEdgeIdentifier, secondEdgeIdentifier],
      [secondEdgeIdentifier, firstEdgeIdentifier],
    ]) {
      const adjacent = neighbors.get(from);
      if (adjacent) {
        adjacent.push(to);
      } else {
        neighbors.set(from, [to]);
      }
    }
  };
  for (let y = 0; y < rows - 1; y++) {
    for (let x = 0; x < columns - 1; x++) {
      const topLeftElevation = calculateRelativeElevation(values[y * columns + x]);
      const topRightElevation = calculateRelativeElevation(values[y * columns + x + 1]);
      const bottomRightElevation = calculateRelativeElevation(values[(y + 1) * columns + x + 1]);
      const bottomLeftElevation = calculateRelativeElevation(values[(y + 1) * columns + x]);
      if (
        topLeftElevation > 0 === topRightElevation > 0 &&
        topLeftElevation > 0 === bottomRightElevation > 0 &&
        topLeftElevation > 0 === bottomLeftElevation > 0
      ) {
        continue;
      }
      const edgeIds = [
        getHorizontalEdgeIdentifier(x, y),
        getVerticalEdgeIdentifier(x + 1, y),
        getHorizontalEdgeIdentifier(x, y + 1),
        getVerticalEdgeIdentifier(x, y),
      ];
      const crossingEdgeIndices = [];
      if (topLeftElevation > 0 !== topRightElevation > 0) {
        ensureInterpolatedEdgePoint(edgeIds[0], x, y, 1, 0, topLeftElevation, topRightElevation);
        crossingEdgeIndices.push(0);
      }
      if (topRightElevation > 0 !== bottomRightElevation > 0) {
        ensureInterpolatedEdgePoint(
          edgeIds[1],
          x + 1,
          y,
          0,
          1,
          topRightElevation,
          bottomRightElevation,
        );
        crossingEdgeIndices.push(1);
      }
      if (bottomLeftElevation > 0 !== bottomRightElevation > 0) {
        ensureInterpolatedEdgePoint(
          edgeIds[2],
          x,
          y + 1,
          1,
          0,
          bottomLeftElevation,
          bottomRightElevation,
        );
        crossingEdgeIndices.push(2);
      }
      if (topLeftElevation > 0 !== bottomLeftElevation > 0) {
        ensureInterpolatedEdgePoint(edgeIds[3], x, y, 0, 1, topLeftElevation, bottomLeftElevation);
        crossingEdgeIndices.push(3);
      }
      if (crossingEdgeIndices.length === 2) {
        connectContourEdges(edgeIds[crossingEdgeIndices[0]], edgeIds[crossingEdgeIndices[1]]);
      }
      if (crossingEdgeIndices.length === 4) {
        const pairs =
          topLeftElevation * bottomRightElevation - topRightElevation * bottomLeftElevation >= 0
            ? [
                [0, 1],
                [2, 3],
              ]
            : [
                [0, 3],
                [1, 2],
              ];
        for (const [first, second] of pairs) {
          connectContourEdges(edgeIds[first], edgeIds[second]);
        }
      }
    }
  }
  const visitedEdgeIdentifiers = /* @__PURE__ */ new Set();
  const paths = [];
  const traceContourPath = (start) => {
    const path = [];
    let current = start;
    let previous = -1;
    while (!visitedEdgeIdentifiers.has(current)) {
      visitedEdgeIdentifiers.add(current);
      const point = points.get(current);
      const adjacentEdges = neighbors.get(current);
      if (point === void 0 || adjacentEdges === void 0) {
        throw new Error(
          `Contour edge ${current.toString()} has incomplete geometry. Check edge stitching.`,
        );
      }
      path.push(point);
      const next = adjacentEdges.find((id) => id !== previous);
      if (next === void 0) {
        break;
      }
      previous = current;
      current = next;
    }
    paths.push({ points: path, closed: current === start && path.length > 2 });
  };
  for (const [id, adjacent] of neighbors) {
    if (adjacent.length === 1 && !visitedEdgeIdentifiers.has(id)) {
      traceContourPath(id);
    }
  }
  for (const id of neighbors.keys()) {
    if (!visitedEdgeIdentifiers.has(id)) {
      traceContourPath(id);
    }
  }
  return { elevation, paths };
}
function extractContours(field, levels) {
  return levels.map((level) => extractContourAtElevation(field, level));
}

// src/terrain-generation.ts
function createSeededRandomGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + seededRandomIncrement) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / unsignedIntegerRange;
  };
}
function createSeededNoiseSampler(seed) {
  const random = createSeededRandomGenerator(seed);
  const permutation = Array.from({ length: noisePermutationSize }, (_, index) => index);
  for (let permutationIndex = noisePermutationMask; permutationIndex > 0; permutationIndex--) {
    const shuffledIndex = Math.floor(random() * (permutationIndex + 1));
    [permutation[permutationIndex], permutation[shuffledIndex]] = [
      permutation[shuffledIndex],
      permutation[permutationIndex],
    ];
  }
  const repeatedPermutation = [...permutation, ...permutation];
  const calculateFadeWeight = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const interpolateLinearly = (a, b, t) => a + t * (b - a);
  const calculateGradientDotProduct = (hash, x, y) => {
    const gradient = noiseGradients[hash & (noiseGradientCount - 1)];
    return gradient[0] * x + gradient[1] * y;
  };
  return (x, y) => {
    const floorX = Math.floor(x);
    const floorY = Math.floor(y);
    const wrappedColumn = floorX & noisePermutationMask;
    const wrappedRow = floorY & noisePermutationMask;
    const fractionalX = x - floorX;
    const fractionalY = y - floorY;
    return (
      Math.SQRT2 *
      interpolateLinearly(
        interpolateLinearly(
          calculateGradientDotProduct(
            repeatedPermutation[repeatedPermutation[wrappedColumn] + wrappedRow],
            fractionalX,
            fractionalY,
          ),
          calculateGradientDotProduct(
            repeatedPermutation[repeatedPermutation[wrappedColumn + 1] + wrappedRow],
            fractionalX - 1,
            fractionalY,
          ),
          calculateFadeWeight(fractionalX),
        ),
        interpolateLinearly(
          calculateGradientDotProduct(
            repeatedPermutation[repeatedPermutation[wrappedColumn] + wrappedRow + 1],
            fractionalX,
            fractionalY - 1,
          ),
          calculateGradientDotProduct(
            repeatedPermutation[repeatedPermutation[wrappedColumn + 1] + wrappedRow + 1],
            fractionalX - 1,
            fractionalY - 1,
          ),
          calculateFadeWeight(fractionalX),
        ),
        calculateFadeWeight(fractionalY),
      )
    );
  };
}
function createTerrainSampler(seed, settings) {
  const noise = createSeededNoiseSampler(seed);
  const random = createSeededRandomGenerator(seed ^ terrainOffsetSeedMask);
  const offsetX = random() * terrainNoiseOffsetRange;
  const offsetY = random() * terrainNoiseOffsetRange;
  const angle = terrainRotationRadians;
  return (x, y) => {
    const rotatedX = (x * Math.cos(angle) - y * Math.sin(angle)) / settings.featureScale;
    const rotatedY = (x * Math.sin(angle) + y * Math.cos(angle)) / settings.featureScale;
    return settings.noiseOctaves.reduce(
      (height, octave) =>
        height +
        octave.amplitude *
          noise(rotatedX * octave.frequency + offsetX, rotatedY * octave.frequency + offsetY),
      0,
    );
  };
}
function sampleTerrain(terrain, width, height, settings) {
  let spacing = settings.sampleSpacing;
  const calculateSampleDimensions = () => ({
    columns:
      Math.ceil((width + settings.overscan) / spacing) + Math.ceil(settings.overscan / spacing) + 1,
    rows:
      Math.ceil((height + settings.overscan) / spacing) +
      Math.ceil(settings.overscan / spacing) +
      1,
  });
  let { columns, rows } = calculateSampleDimensions();
  while (columns * rows > settings.maxSamples) {
    spacing *= 2;
    ({ columns, rows } = calculateSampleDimensions());
  }
  const originX = -Math.ceil(settings.overscan / spacing) * spacing;
  const originY = originX;
  const values = new Float64Array(columns * rows);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      values[row * columns + column] = terrain(originX + column * spacing, originY + row * spacing);
    }
  }
  return { columns, rows, originX, originY, spacing, values };
}

// src/landscape-composition.ts
function calculateContourElevations(settings, engineConfiguration2) {
  return Array.from(
    { length: settings.contourCount },
    (_, index) =>
      engineConfiguration2.elevationMin +
      (index * (engineConfiguration2.elevationMax - engineConfiguration2.elevationMin)) /
        (settings.contourCount - 1),
  );
}
function generateLandscapeGeometry(settings, engineConfiguration2, realTerrain) {
  const terrainSettings = deriveTerrainConfiguration(settings, engineConfiguration2);
  const field = sampleTerrain(
    realTerrain
      ? (x, y) => realTerrain.sample(x, y, settings.width, settings.height)
      : createTerrainSampler(settings.seed, terrainSettings),
    settings.width,
    settings.height,
    terrainSettings,
  );
  return {
    contours: extractContours(field, calculateContourElevations(settings, engineConfiguration2)),
    summits: findTerrainSummits(field),
  };
}

// src/svg-rendering.ts
var indexContourElevationTolerance = 1e-6;
var svgCoordinateDecimalPlaces = 3;
function createSvgDocument(contours, settings, summits = [], attribution) {
  const { width, height, background, transparent } = settings;
  const backdrop = transparent
    ? ''
    : `<rect width="${width}" height="${height}" fill="${background}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" overflow="hidden">${attribution !== void 0 ? `<metadata>${attribution}</metadata>` : ''}<defs><clipPath id="landscape-crop"><rect width="${width}" height="${height}"/></clipPath></defs><g clip-path="url(#landscape-crop)">${backdrop}${createGridMarkup(width, height, settings)}${getContourMarkup(contours, settings)}${createSummitMarkerMarkup(summits, settings)}${attribution !== void 0 ? `<text x="8" y="${height - 8}" fill="${settings.lineColor}" font-family="sans-serif" font-size="${Math.min(9, ((width - 16) / Math.max(1, attribution.length)) * 1.6)}">${attribution}</text>` : ''}</g></svg>`;
}
function getContourMarkup(contours, settings) {
  const interval = contours.length > 1 ? contours[1].elevation - contours[0].elevation : 1;
  const getContourStyle = (contour) => {
    if (settings.indexStyle === 'off') {
      return 'ordinary';
    }
    const multiple = contour.elevation / (interval * settings.indexEvery);
    const indexLevel = Math.round(multiple);
    if (Math.abs(multiple - indexLevel) >= indexContourElevationTolerance) {
      return 'ordinary';
    }
    return settings.indexStyle === 'dashed' ||
      (settings.indexStyle === 'alternating' && Math.abs(indexLevel % 2) === 1)
      ? 'dashed'
      : 'solid';
  };
  const styles =
    settings.indexStyle === 'alternating'
      ? ['ordinary', 'solid', 'dashed']
      : ['ordinary', settings.indexStyle === 'dashed' ? 'dashed' : 'solid'];
  return styles
    .map((style) => {
      const isIndex = style !== 'ordinary';
      const dashAttribute =
        style === 'dashed' ? ` stroke-dasharray="${settings.dashLength} ${settings.dashGap}"` : '';
      const pathData = contours
        .filter((contour) => getContourStyle(contour) === style)
        .flatMap((contour) =>
          contour.paths.map(
            ({ points, closed }) =>
              points
                .map(
                  (point, pointIndex) =>
                    `${pointIndex === 0 ? 'M' : 'L'}${point.x.toFixed(svgCoordinateDecimalPlaces)},${point.y.toFixed(svgCoordinateDecimalPlaces)}`,
                )
                .join('') + (closed ? 'Z' : ''),
          ),
        )
        .join('');
      return `<path fill="none" stroke="${settings.lineColor}" stroke-width="${isIndex ? settings.indexStrokeWidth : settings.strokeWidth}" stroke-opacity="${settings.strokeOpacity}" stroke-linejoin="round" stroke-linecap="round"${dashAttribute} d="${pathData}"/>`;
    })
    .join('');
}
function createGridMarkup(width, height, settings) {
  if (settings.gridStyle === 'off') {
    return '';
  }
  const spacing = settings.gridSpacing;
  const mark =
    settings.gridStyle === 'squares'
      ? `<path d="M${spacing},0H0V${spacing}"/>`
      : `<path d="M${spacing / 2 - 4},${spacing / 2}h8M${spacing / 2},${spacing / 2 - 4}v8"/>`;
  return `<defs><pattern id="terrain-grid" width="${spacing}" height="${spacing}" patternUnits="userSpaceOnUse"><g fill="none" stroke="${settings.lineColor}" stroke-width="0.6">${mark}</g></pattern></defs><rect width="${width}" height="${height}" fill="url(#terrain-grid)" opacity="${settings.gridOpacity}"/>`;
}

// src/export/image-export.ts
function createOutputRenderer(engineConfiguration2, getRealTerrain = () => void 0) {
  let cachedRealTerrain;
  let cachedGeometryKey;
  let geometry = { contours: [], summits: [] };
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
        geometry = generateLandscapeGeometry(settings, engineConfiguration2, realTerrain);
        cachedRealTerrain = realTerrain;
        cachedGeometryKey = geometryCacheKey;
      }
      return createSvgDocument(
        geometry.contours,
        settings,
        geometry.summits,
        realTerrain?.attribution,
      );
    },
  };
}
function getRasterDimensions(settings) {
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
        message: `PNG dimensions must be at most ${maximumDimensionPixels} px per side. Choose 1\xD7 or reduce the output size.`,
        retryable: true,
      },
    };
  }
  return { ok: true, data: { width, height } };
}

// src/export/node-image-export.ts
import { Resvg } from '@resvg/resvg-js';
function createNodeExportFile(settings, renderer) {
  const dimensions =
    settings.format === 'png'
      ? getRasterDimensions(settings)
      : { ok: true, data: { width: settings.width, height: settings.height } };
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
        filename: `topogra-${settings.seed}-${dimensions.data.width}x${dimensions.data.height}.${settings.format}`,
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
function rasterizeSvgAsPng(svg, width) {
  return new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
}

// src/node-real-terrain.ts
import { PNG } from 'pngjs';

// src/real-terrain.ts
var earthCircumferenceMeters = 40075016686e-3;
var tileSizePixels = 256;
function decodeTerrariumElevation(red, green, blue) {
  return red * 256 + green + blue / 256 - 32768;
}
async function loadRealTerrain(latitude, longitude, spanKm, loadTile) {
  if (
    !Number.isFinite(latitude) ||
    latitude < realTerrainBounds.minimumLatitude ||
    latitude > realTerrainBounds.maximumLatitude ||
    !Number.isFinite(longitude) ||
    longitude < realTerrainBounds.minimumLongitude ||
    longitude > realTerrainBounds.maximumLongitude ||
    !Number.isFinite(spanKm) ||
    spanKm < realTerrainBounds.minimumSpanKm ||
    spanKm > realTerrainBounds.maximumSpanKm
  ) {
    throw new Error(
      'Use latitude \u221285 to 85, longitude \u2212180 to 180, and an area width of 2\u2013200 km.',
    );
  }
  const latitudeRadians = (latitude * Math.PI) / 180;
  const spanFraction = (spanKm * 1e3) / (earthCircumferenceMeters * Math.cos(latitudeRadians));
  const zoom = Math.max(0, Math.min(14, Math.floor(Math.log2(2 / spanFraction))));
  const tileCount = 2 ** zoom;
  const centerX = ((longitude + 180) / 360) * tileCount;
  const centerY = ((1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2) * tileCount;
  const spanTiles = spanFraction * tileCount;
  const startX = Math.floor(centerX - spanTiles / 2);
  const startY = Math.floor(centerY - spanTiles / 2);
  const endX = Math.floor(centerX + spanTiles / 2);
  const endY = Math.floor(centerY + spanTiles / 2);
  const columns = (endX - startX + 1) * tileSizePixels;
  const rows = (endY - startY + 1) * tileSizePixels;
  const elevations = new Float64Array(columns * rows);
  const requests = [];
  const credits = /* @__PURE__ */ new Set();
  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      requests.push(loadTerrainTile(x, y));
    }
  }
  await Promise.all(requests);
  let minimum = Infinity;
  let maximum = -Infinity;
  for (const elevation of elevations) {
    minimum = Math.min(minimum, elevation);
    maximum = Math.max(maximum, elevation);
  }
  const elevationRange = Math.max(1, maximum - minimum);
  return {
    attribution: [...credits].join(' \xB7 '),
    sample(x, y, width, height) {
      const frameSize = Math.max(width, height);
      const pixelX = Math.max(
        0,
        Math.min(
          columns - 1,
          (centerX - startX + ((x - width / 2) / frameSize) * spanTiles) * tileSizePixels,
        ),
      );
      const pixelY = Math.max(
        0,
        Math.min(
          rows - 1,
          (centerY - startY + ((y - height / 2) / frameSize) * spanTiles) * tileSizePixels,
        ),
      );
      const left = Math.floor(pixelX);
      const top = Math.floor(pixelY);
      const right = Math.min(columns - 1, left + 1);
      const bottom = Math.min(rows - 1, top + 1);
      const fractionX = pixelX - left;
      const fractionY = pixelY - top;
      const upper =
        elevations[top * columns + left] * (1 - fractionX) +
        elevations[top * columns + right] * fractionX;
      const lower =
        elevations[bottom * columns + left] * (1 - fractionX) +
        elevations[bottom * columns + right] * fractionX;
      return ((upper * (1 - fractionY) + lower * fractionY - minimum) / elevationRange - 0.5) * 1.6;
    },
  };
  async function loadTerrainTile(x, y) {
    const wrappedX = ((x % tileCount) + tileCount) % tileCount;
    const boundedY = Math.max(0, Math.min(tileCount - 1, y));
    const tile = await loadTile(
      `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${wrappedX}/${boundedY}.png`,
    );
    const sources = tile.imagerySources.toLowerCase();
    for (const [identifiers, credit] of terrainCredits) {
      if (identifiers.some((identifier) => sources.includes(identifier)) || sources === '') {
        credits.add(credit);
      }
    }
    if (tile.pixels.length !== tileSizePixels * tileSizePixels * 4) {
      throw new Error('Terrain tile has unexpected dimensions.');
    }
    for (let row = 0; row < tileSizePixels; row++) {
      for (let column = 0; column < tileSizePixels; column++) {
        const offset = (row * tileSizePixels + column) * 4;
        elevations[
          ((y - startY) * tileSizePixels + row) * columns + (x - startX) * tileSizePixels + column
        ] = decodeTerrariumElevation(
          tile.pixels[offset],
          tile.pixels[offset + 1],
          tile.pixels[offset + 2],
        );
      }
    }
  }
}
var terrainCredits = [
  [
    ['eudem'],
    'Produced using Copernicus data and information funded by the European Union \u2014 EU-DEM layers',
  ],
  [
    ['ned', '3dep', 'srtm', 'gmted'],
    '3DEP, SRTM and GMTED2010 terrain data courtesy of the U.S. Geological Survey',
  ],
  [['etopo'], 'ETOPO1: DOC/NOAA/NESDIS/NCEI, U.S. Department of Commerce'],
  [['aster', 'arctic'], 'ArcticDEM: DigitalGlobe imagery; NSF awards 1043681, 1559691 and 1542736'],
  [['australia'], '\xA9 Commonwealth of Australia (Geoscience Australia) 2017'],
  [
    ['austria'],
    '\xA9 offene Daten \xD6sterreichs \u2014 Digitales Gel\xE4ndemodell (DGM) \xD6sterreich',
  ],
  [
    ['canada', 'cdem'],
    'Contains information licensed under the Open Government Licence \u2014 Canada',
  ],
  [['mexico', 'inegi'], 'Source: INEGI, Continental relief, 2016'],
  [
    ['newzealand', 'nz', 'linz'],
    'Copyright 2011 Crown copyright (c) Land Information New Zealand and the New Zealand Government. All rights reserved',
  ],
  [['norway'], '\xA9 Kartverket'],
  [
    ['uk', 'greatbritain'],
    '\xA9 Environment Agency copyright and/or database right 2015. All rights reserved',
  ],
];

// src/node-real-terrain.ts
var terrainTileTimeoutMs = 2e4;
var terrainTileSizePixels = 256;
async function loadNodeRealTerrain(latitude, longitude, spanKm) {
  return loadRealTerrain(latitude, longitude, spanKm, decodeNodeTerrainTile);
}
async function decodeNodeTerrainTile(tileUrl) {
  const response = await fetch(tileUrl, { signal: AbortSignal.timeout(terrainTileTimeoutMs) });
  if (!response.ok) {
    throw new Error(
      `Terrain tile download failed (${response.status}). Try again or choose another area.`,
    );
  }
  const png = PNG.sync.read(Buffer.from(await response.arrayBuffer()));
  if (png.width !== terrainTileSizePixels || png.height !== terrainTileSizePixels) {
    throw new Error('Terrain tile has unexpected dimensions.');
  }
  return {
    pixels: png.data,
    imagerySources: response.headers.get('x-amz-meta-x-imagery-sources') ?? '',
  };
}

// src/random-palette.ts
var minimumContourContrastRatio = 3;
function createRandomPalette(random = Math.random) {
  const hue = random() * 360;
  const isDarkBackground = random() < 0.5;
  const darkLightness = 0.04 + random() * 0.1;
  const lightLightness = 0.84 + random() * 0.12;
  const background = convertHslToRgb(
    hue,
    0.25 + random() * 0.6,
    isDarkBackground ? darkLightness : lightLightness,
  );
  const contours = convertHslToRgb(
    (hue + 180) % 360,
    0.25 + random() * 0.6,
    isDarkBackground ? lightLightness : darkLightness,
  );
  let strokeOpacity = 0.8;
  while (
    strokeOpacity < 1 &&
    calculateContrast(background, contours, strokeOpacity) < minimumContourContrastRatio
  ) {
    strokeOpacity = Math.min(1, Number((strokeOpacity + 0.01).toFixed(2)));
  }
  return {
    background: formatHexColor(background),
    lineColor: formatHexColor(contours),
    strokeOpacity,
  };
}
function convertHslToRgb(hue, saturation, lightness) {
  const amplitude = saturation * Math.min(lightness, 1 - lightness);
  const channel = (offset) => {
    const position = (offset + hue / 30) % 12;
    return Math.round(
      255 * (lightness - amplitude * Math.max(-1, Math.min(position - 3, 9 - position, 1))),
    );
  };
  return [channel(0), channel(8), channel(4)];
}
function calculateContrast(background, contours, opacity) {
  const blended = contours.map(
    (channel, index) => channel * opacity + background[index] * (1 - opacity),
  );
  const backgroundLuminance = calculateLuminance(background);
  const contourLuminance = calculateLuminance(blended);
  return (
    (Math.max(backgroundLuminance, contourLuminance) + 0.05) /
    (Math.min(backgroundLuminance, contourLuminance) + 0.05)
  );
}
function calculateLuminance(channels) {
  const linear = channels.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
function formatHexColor(channels) {
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

// src/cli.ts
var cliConfigVersion = 1;
var browserBaseUrl = 'https://conorluddy.github.io/Topogra/';
var designKeys = Object.keys(versionOneDesignDefaults);
var booleanKeys = /* @__PURE__ */ new Set([
  'summitTrianglesEnabled',
  'summitCrossesEnabled',
  'cursorEnabled',
  'transparent',
  'allowExtraLargeExports',
]);
var designSettingDescriptions = {
  seed: 'An unsigned 32-bit value that fully determines generated terrain. Provide it when repeatability matters; if omitted, the CLI creates a new seed and reports it in diagnostics or JSON metadata.',
  gridStyle:
    'Adds a decorative, non-geographic overlay. Choose off for none, squares for corner marks, or crosses for centre marks; the same overlay appears in SVG and PNG.',
  gridSpacing:
    'Sets the grid\u2019s repeated cell size in output pixels. It affects only squares and crosses, and does not change terrain sampling or contour geometry.',
  gridOpacity:
    'Controls how faint the decorative grid appears. It is independent of contour opacity so grid and terrain line contrast can be tuned separately.',
  background:
    'The six-digit hexadecimal canvas colour used by opaque exports. It is omitted entirely when transparent output is enabled.',
  lineColor:
    'The six-digit hexadecimal colour for contours, the decorative grid, summit symbols, and real-terrain attribution. Quote shell-sensitive values beginning with #.',
  strokeWidth:
    'The ordinary contour stroke weight in output pixels. PNG rasterization scales this weight with --png-scale while SVG keeps it as a vector unit.',
  strokeOpacity:
    'The opacity applied to ordinary and index contours, as well as summit markers. It is composited over the chosen background in opaque output.',
  contourCount:
    'The odd number of evenly spaced elevation levels to extract. More levels create denser line work without changing the underlying sampled terrain.',
  featureScale:
    'The characteristic size of generated landforms in output pixels. Larger values produce broader terrain features; this setting is ignored by real terrain.',
  detail:
    'Blends high-frequency noise into generated terrain while preserving the engine\u2019s total amplitude. It is ignored by real terrain, whose elevations come from tiles.',
  indexStyle:
    'Controls emphasized contours: dashed, solid, alternating between dashed and solid, or off. Index levels are determined from elevation rather than path order.',
  indexEvery:
    'Marks every Nth elevation level as an index contour. This remains stored even when index contours are off, allowing a design to be restored without losing inactive choices.',
  indexStrokeWidth:
    'The stroke weight for index contours only. It combines with --index-style and does not affect ordinary contour paths.',
  dashLength:
    'The painted segment length for dashed index contours, in output pixels. It is inactive for solid or off index styles but remains preserved in configs and URLs.',
  dashGap:
    'The empty segment length for dashed index contours, in output pixels. It is inactive for solid or off index styles but remains preserved in configs and URLs.',
  summitMarkerSize:
    'Selects small, medium, or large summit symbols. It scales either marker shape around the same detected summit coordinates.',
  summitTrianglesEnabled:
    'Enables triangular summit markers. It can be combined with cross markers; neither changes contour extraction or summit detection.',
  summitCrossesEnabled:
    'Enables cross-shaped summit markers. It can be combined with triangles; neither changes contour extraction or summit detection.',
  cursorEnabled:
    'Preserves the browser interaction preference in configs and browser links. CLI exports are always settled static terrain, so this value never applies a cursor deformation.',
  cursorRadius:
    'Preserves the browser cursor influence radius in pixels. It has no visual effect in static CLI output but is retained for round-tripping a design.',
  cursorHeight:
    'Preserves browser cursor deformation strength; negative values represent a depression. It has no visual effect in static CLI output but is retained for round-tripping.',
  cursorResponseMs:
    'Preserves the browser cursor animation response time in milliseconds. Static CLI output has no animation and therefore does not use this value.',
  format:
    'Chooses SVG vector output or PNG raster output. The output filename extension must match this choice unless image bytes are sent to stdout.',
  width:
    'Sets the output frame width in pixels. CLI output uses explicit dimensions rather than a viewport or device-screen choice.',
  height:
    'Sets the output frame height in pixels. CLI output uses explicit dimensions rather than a viewport or device-screen choice.',
  pngScale:
    'Selects 1\xD7 or 2\xD7 PNG rasterization. It doubles raster dimensions and pixel stroke widths at 2\xD7; SVG ignores it.',
  transparent:
    'Removes the background rectangle while retaining contours, grid, markers, and attribution. PNG pixels outside artwork retain alpha zero.',
  allowExtraLargeExports:
    'Raises the maximum side from 4096 to 12288 pixels. It is an explicit memory-cost opt-in and still applies after PNG scaling.',
};
async function runCli(argv, io = process) {
  try {
    const [command = 'generate', ...argumentsList] = argv;
    if (command === '--help' || command === '-h') {
      return printHelp(io.stdout, argv.includes('--verbose'));
    }
    if (command === '--version') {
      return write(io.stdout, 'topogra 0.1.0\n');
    }
    if (argumentsList.includes('--help') || argumentsList.includes('-h')) {
      return printHelp(io.stdout, argumentsList.includes('--verbose'));
    }
    if (argumentsList.includes('--verbose')) {
      throw new Error('--verbose is available only with --help.');
    }
    const options = parseOptions(argumentsList);
    if (command === 'presets') {
      return printPresets(options, io.stdout);
    }
    if (command === 'validate') {
      return await validateCommand(options, io.stdout);
    }
    if (command !== 'generate') {
      throw new Error(`Unknown command "${command}". Use "topogra --help".`);
    }
    return await generateCommand(options, io);
  } catch (error) {
    write(
      io.stderr,
      `topogra: ${error instanceof Error ? error.message : 'Unexpected failure.'}
`,
    );
    return 2;
  }
}
function parseOptions(argumentsList) {
  const values = {
    config: { type: 'string' },
    url: { type: 'string' },
    output: { type: 'string' },
    format: { type: 'string' },
    palette: { type: 'string' },
    size: { type: 'string' },
    terrain: { type: 'string' },
    'terrain-preset': { type: 'string' },
    latitude: { type: 'string' },
    longitude: { type: 'string' },
    'span-km': { type: 'string' },
    json: { type: 'string' },
    force: { type: 'string' },
    'save-config': { type: 'string' },
    attribution: { type: 'string' },
    'attribution-file': { type: 'string' },
  };
  for (const key of designKeys) {
    values[toKebab(key)] = { type: 'string' };
  }
  const { values: parsed, positionals } = parseArgs({
    args: argumentsList,
    options: values,
    allowPositionals: true,
    strict: true,
  });
  if (positionals.length) {
    throw new Error(`Unexpected argument "${positionals[0]}".`);
  }
  return parsed;
}
async function generateCommand(options, io) {
  if (options.config !== void 0 && options.url !== void 0) {
    throw new Error('--config and --url are mutually exclusive.');
  }
  let terrain = { mode: 'generated' };
  let source = {};
  if (options.config !== void 0) {
    ({ settings: source, terrain = terrain } = await readConfig(options.config));
  }
  if (options.url !== void 0) {
    source = readUrl(options.url);
  }
  if (options.palette !== void 0) {
    source = { ...source, ...readPalette(options.palette) };
  }
  if (options.size !== void 0) {
    source = { ...source, ...readSize(options.size) };
  }
  source = { ...source, ...readDesignFlags(options) };
  terrain = readTerrain(options, terrain);
  validateTerrainConfig(terrain);
  source.seed ??= randomBytes(4).readUInt32BE();
  const validation = validateDesignSettings({ ...versionOneDesignDefaults, ...source });
  if (!validation.ok) {
    throw new Error(validation.error.message);
  }
  const settings = validation.data;
  if (options['save-config'] !== void 0) {
    await writeAtomically(
      options['save-config'],
      new TextEncoder().encode(
        `${JSON.stringify({ version: cliConfigVersion, settings, terrain }, null, 2)}
`,
      ),
      isEnabled(options, 'force'),
    );
  }
  const output =
    options.output ??
    `topogra-${settings.seed}-${settings.width * (settings.format === 'png' ? settings.pngScale : 1)}x${settings.height * (settings.format === 'png' ? settings.pngScale : 1)}.${settings.format}`;
  if (isEnabled(options, 'json') && output === '-') {
    throw new Error('--json cannot be combined with --output -.');
  }
  validateOutputExtension(output, settings.format);
  const loadedTerrain =
    terrain.mode === 'real'
      ? await loadNodeRealTerrain(terrain.latitude, terrain.longitude, terrain.spanKm)
      : void 0;
  validateAttributionOptions(options, loadedTerrain);
  if (options['attribution-file'] !== void 0 && loadedTerrain !== void 0) {
    await writeAtomically(
      options['attribution-file'],
      new TextEncoder().encode(`${loadedTerrain.attribution}
`),
      isEnabled(options, 'force'),
    );
  }
  const result = createNodeExportFile(
    settings,
    createOutputRenderer(engineConfiguration, () => loadedTerrain),
  );
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  if (output === '-') {
    io.stdout.write(result.data.bytes);
  } else {
    await writeAtomically(output, result.data.bytes, isEnabled(options, 'force'));
  }
  if (isEnabled(options, 'json')) {
    write(
      io.stdout,
      `${JSON.stringify(metadata(result.data.filename, settings, terrain, loadedTerrain, output), null, 2)}
`,
    );
  } else if (output !== '-') {
    write(
      io.stderr,
      `Generated ${output} (seed ${settings.seed}).
`,
    );
  }
  return 0;
}
function validateCommand(options, stdout) {
  if (options.config === void 0) {
    throw new Error('validate requires --config FILE.');
  }
  return readConfig(options.config).then(({ settings }) => {
    const result = validateDesignSettings(settings);
    if (!result.ok) {
      throw new Error(result.error.message);
    }
    write(stdout, 'Configuration is valid.\n');
    return 0;
  });
}
function printPresets(options, stdout) {
  const presets = {
    palettes: [...Object.keys(designPalettePresets), 'random'],
    sizes: getOutputSizePresets(),
    terrain: realTerrainPresets,
  };
  write(
    stdout,
    isEnabled(options, 'json')
      ? `${JSON.stringify(presets, null, 2)}
`
      : `Palettes: ${presets.palettes.join(', ')}
Sizes: ${presets.sizes.map((preset) => preset.value).join(', ')}
Terrain: ${presets.terrain.map((preset) => preset.name).join(', ')}
`,
  );
  return 0;
}
function readDesignFlags(options) {
  const settings = {};
  for (const key of designKeys) {
    const value = options[toKebab(key)];
    if (value === void 0) {
      continue;
    }
    settings[key] = booleanKeys.has(key)
      ? parseBoolean(value, toKebab(key))
      : key === 'pngScale' || key in designNumberConstraints
        ? Number(value)
        : value;
  }
  return settings;
}
function readUrl(value) {
  const url = new URL(value);
  const parsed = parseDesignParameters(url.searchParams);
  if (!parsed.ok || parsed.data.warnings.length) {
    throw new Error(
      parsed.ok
        ? `Invalid URL settings: ${parsed.data.warnings.join(', ')}.`
        : parsed.error.message,
    );
  }
  return parsed.data.settings;
}
async function readConfig(path) {
  let config;
  try {
    config = JSON.parse(await readFile(path, 'utf8'));
  } catch {
    throw new Error(`Could not read configuration "${path}".`);
  }
  if (
    config === null ||
    typeof config !== 'object' ||
    config.version !== cliConfigVersion ||
    !('settings' in config) ||
    Object.keys(config).some((key) => !['version', 'settings', 'terrain'].includes(key))
  ) {
    throw new Error(`Configuration must be a version ${cliConfigVersion} CLI envelope.`);
  }
  const settings = config.settings;
  if (
    settings === null ||
    typeof settings !== 'object' ||
    Object.keys(settings).some((key) => !designKeys.includes(key))
  ) {
    throw new Error('Configuration settings must contain only supported design fields.');
  }
  return config;
}
function readPalette(value) {
  if (value === 'random') {
    return createRandomPalette();
  }
  if (!Object.hasOwn(designPalettePresets, value)) {
    throw new Error(`Unknown palette "${value}".`);
  }
  const preset = designPalettePresets[value];
  return preset;
}
function readSize(value) {
  const preset = getOutputSizePresets().find((entry) => entry.value === value);
  if (!preset) {
    throw new Error(`Unknown output size "${value}".`);
  }
  const [width, height] = value.split('x').map(Number);
  return { width, height };
}
function getOutputSizePresets() {
  return outputSizePresetGroups.flatMap((group) => [...group.presets]);
}
function readTerrain(options, current) {
  const mode = options.terrain;
  if (mode !== void 0 && mode !== 'generated' && mode !== 'real') {
    throw new Error('--terrain must be generated or real.');
  }
  const preset = options['terrain-preset'];
  if (preset !== void 0) {
    const place = realTerrainPresets.find(
      (entry) => entry.name.toLowerCase() === preset.toLowerCase(),
    );
    if (!place) {
      throw new Error(`Unknown terrain preset "${preset}".`);
    }
    return {
      mode: 'real',
      latitude: place.latitude,
      longitude: place.longitude,
      spanKm: Number(options['span-km'] ?? realTerrainBounds.defaultSpanKm),
    };
  }
  if (mode === 'real' || options.latitude !== void 0 || options.longitude !== void 0) {
    const latitude = Number(options.latitude);
    const longitude = Number(options.longitude);
    const spanKm = Number(options['span-km'] ?? realTerrainBounds.defaultSpanKm);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error('Real terrain requires --latitude and --longitude.');
    }
    return { mode: 'real', latitude, longitude, spanKm };
  }
  return mode === 'generated' ? { mode } : current;
}
function validateTerrainConfig(terrain) {
  if (terrain.mode === 'generated') {
    return;
  }
  if (
    !Number.isFinite(terrain.latitude) ||
    terrain.latitude < realTerrainBounds.minimumLatitude ||
    terrain.latitude > realTerrainBounds.maximumLatitude ||
    !Number.isFinite(terrain.longitude) ||
    terrain.longitude < realTerrainBounds.minimumLongitude ||
    terrain.longitude > realTerrainBounds.maximumLongitude ||
    !Number.isFinite(terrain.spanKm) ||
    terrain.spanKm < realTerrainBounds.minimumSpanKm ||
    terrain.spanKm > realTerrainBounds.maximumSpanKm
  ) {
    throw new Error(
      'Use latitude \u221285 to 85, longitude \u2212180 to 180, and an area width of 2\u2013200 km.',
    );
  }
}
function validateOutputExtension(output, format) {
  if (output === '-') {
    return;
  }
  const extension = output.split('.').pop()?.toLowerCase();
  if (extension !== void 0 && extension !== format) {
    throw new Error(`Output extension .${extension} conflicts with --format ${format}.`);
  }
}
function metadata(filename, settings, terrain, loadedTerrain, output) {
  return {
    output,
    filename,
    settings,
    terrain,
    attribution: loadedTerrain?.attribution,
    browserLink: getDesignUrl(browserBaseUrl, settings),
    browserLinkRestoresTerrain: terrain.mode === 'generated',
  };
}
function validateAttributionOptions(options, terrain) {
  const mode = options.attribution;
  if (mode !== void 0 && mode !== 'embedded') {
    throw new Error('--attribution currently supports only embedded.');
  }
  if (options['attribution-file'] !== void 0 && terrain === void 0) {
    throw new Error('--attribution-file requires real terrain.');
  }
}
async function writeAtomically(path, bytes, force) {
  const target = resolve(path);
  if (!force) {
    try {
      await stat(target);
      throw new Error(`Output "${path}" already exists. Use --force true to replace it.`);
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
        throw error;
      }
    }
  }
  const temporary = `${target}.topogra-${process.pid}.tmp`;
  try {
    await writeFile(temporary, bytes);
    await rename(temporary, target);
  } catch (error) {
    await unlink(temporary).catch(() => void 0);
    throw error;
  }
}
function parseBoolean(value, flag) {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  throw new Error(`--${flag} must be true or false.`);
}
function isEnabled(options, key) {
  const value = options[key];
  return value === void 0 ? false : parseBoolean(value, key);
}
function toKebab(value) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
function write(stream, value) {
  stream.write(value);
  return 0;
}
function printHelp(stdout, isVerbose = false) {
  return write(
    stdout,
    `Topogra CLI

Usage: topogra generate [options]
       topogra presets [--json true]
       topogra validate --config design.json

Sources apply as defaults \u2192 config or URL \u2192 palette/size \u2192 explicit flags. --output - writes image bytes; --json true is incompatible with it. Existing files require --force true.

Generator options:
  --config FILE | --url URL    Versioned CLI config or v=1 browser URL (mutually exclusive)
  --palette NAME               ${[...Object.keys(designPalettePresets), 'random'].join(', ')}
  --size WIDTHxHEIGHT          A listed output size; use presets --json true to discover values
  --terrain generated|real     Real mode requires coordinates or --terrain-preset NAME
  --latitude NUMBER --longitude NUMBER --span-km NUMBER
  --format svg|png --output FILE|- --save-config FILE
  --attribution embedded       Keep real-terrain credit visibly embedded (the default)
  --attribution-file FILE      Write the resolved real-terrain credit alongside the image
  --json true|false --force true|false

Design flags (default; range where applicable):
${getDesignFlagReference(isVerbose)}
${isVerbose ? '' : '\nUse --help --verbose for a full description of every design flag.\n'}`,
  );
}
function getDesignFlagReference(isVerbose) {
  return designKeys
    .map((key) => {
      const range = Object.hasOwn(designNumberConstraints, key)
        ? (() => {
            const constraint = designNumberConstraints[key];
            return `; ${constraint[0]}\u2013${constraint[1]} step ${constraint[2]}`;
          })()
        : '';
      const reference = `  --${toKebab(key)} VALUE    ${String(versionOneDesignDefaults[key])}${range}`;
      return isVerbose
        ? `
${reference}

${designSettingDescriptions[key]}
`
        : reference;
    })
    .join('\n');
}
if (import.meta.url === `file://${process.argv[1]}`) {
  void runCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
export { runCli };
