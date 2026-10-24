import {
  designNumberConstraints,
  designUrlVersion,
  imageExportFormats,
  indexContourStyles,
  numericStepTolerance,
  outputSettingKeys,
  terrainSettingKeys,
  versionOneDesignDefaults,
} from './constants/design';
import { operationErrorCodes } from './constants/operations';
import { detailNoiseOctaves } from './constants/terrain';
import type {
  DesignChangeKind,
  DesignSettings,
  LoadedDesign,
  ValidatedDesignSettings,
} from './types/design';
import type { Result } from './types/operations';
import type { EngineConfiguration, TerrainConfiguration } from './types/terrain';

// === PUBLIC API ===
/** Restores a design while replacing unsupported field values with stable defaults. */
export function parseDesignParameters(
  parameters: URLSearchParams,
  defaults: Readonly<DesignSettings> = versionOneDesignDefaults,
): Result<LoadedDesign> {
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
  const warnings: string[] = [];
  for (const key of Object.keys(versionOneDesignDefaults) as (keyof DesignSettings)[]) {
    const serializedValue = parameters.get(key);
    if (serializedValue === null) {
      continue;
    }
    const value = parseDesignSettingValue(key, serializedValue);
    if (value === undefined) {
      warnings.push(key);
    } else {
      Object.assign(settings, { [key]: value });
    }
  }
  return {
    ok: true,
    data: { settings: Object.freeze(settings) as ValidatedDesignSettings, warnings },
  };
}

/** Validates an entire edit before it can enter application state. */
export function validateDesignSettings(settings: DesignSettings): Result<ValidatedDesignSettings> {
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

/** Serializes all design fields so links preserve inactive settings. */
export function serializeDesignParameters(settings: Readonly<DesignSettings>): URLSearchParams {
  const parameters = new URLSearchParams({ v: designUrlVersion });
  for (const key of Object.keys(versionOneDesignDefaults) as (keyof DesignSettings)[]) {
    parameters.set(key, String(settings[key]));
  }
  return parameters;
}

/** Builds a shareable URL while preserving its path and fragment. */
export function getDesignUrl(baseUrl: string, settings: Readonly<DesignSettings>): string {
  const url = new URL(baseUrl);
  url.search = serializeDesignParameters(settings).toString();
  return url.href;
}

/** Selects the least expensive refresh that can apply a setting change. */
export function classifyDesignSettingChange(key: keyof DesignSettings): DesignChangeKind {
  if (terrainSettingKeys.includes(key)) {
    return 'terrain';
  }
  if (key === 'contourCount') {
    return 'contours';
  }
  if (key.startsWith('cursor')) {
    return 'cursor';
  }
  if (outputSettingKeys.some((outputSettingKey) => outputSettingKey === key)) {
    return 'output';
  }
  return 'appearance';
}

/** Blends detail octaves without changing total terrain amplitude. */
export function deriveTerrainConfiguration(
  settings: Readonly<DesignSettings>,
  engineConfiguration: Readonly<EngineConfiguration>,
): TerrainConfiguration {
  return {
    ...engineConfiguration,
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

/** Restores appearance and interaction while preserving seed and output options. */
export function resetDesignStyle(settings: Readonly<DesignSettings>): DesignSettings {
  const { seed, format, width, height, pngScale, transparent } = settings;
  return { ...versionOneDesignDefaults, seed, format, width, height, pngScale, transparent };
}

/** Bounds viewport dimensions to the supported output range. */
export function clampOutputDimensionPixels(dimensionPixels: number): number {
  return Math.min(
    designNumberConstraints.width[1],
    Math.max(designNumberConstraints.width[0], dimensionPixels),
  );
}

/** Accepts only canonical values supported by the controls and link contract. */
function parseDesignSettingValue(
  key: keyof DesignSettings,
  serializedValue: string,
): string | number | boolean | undefined {
  if (key in designNumberConstraints) {
    if (!/^-?\d+(\.\d+)?$/.test(serializedValue)) {
      return undefined;
    }
    const value = Number(serializedValue);
    const [minimumValue, maximumValue, stepSize] =
      designNumberConstraints[key as keyof typeof designNumberConstraints];
    if (
      !Number.isFinite(value) ||
      value < minimumValue ||
      value > maximumValue ||
      Math.abs((value - minimumValue) / stepSize - Math.round((value - minimumValue) / stepSize)) >
        numericStepTolerance
    ) {
      return undefined;
    }
    return value;
  }
  if (key === 'background' || key === 'lineColor') {
    return /^#[0-9a-f]{6}$/i.test(serializedValue) ? serializedValue.toLowerCase() : undefined;
  }
  if (key === 'cursorEnabled' || key === 'transparent') {
    return serializedValue === 'true' ? true : serializedValue === 'false' ? false : undefined;
  }
  if (key === 'indexStyle') {
    return indexContourStyles.some((style) => style === serializedValue)
      ? serializedValue
      : undefined;
  }
  if (key === 'format') {
    return imageExportFormats.some((format) => format === serializedValue)
      ? serializedValue
      : undefined;
  }
  if (key === 'pngScale') {
    return serializedValue === '1' ? 1 : serializedValue === '2' ? 2 : undefined;
  }
  return undefined;
}
