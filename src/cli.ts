import { randomBytes } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { link, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { version } from '../package.json';
import { designNumberConstraints, versionOneDesignDefaults } from './constants/design';
import { engineConfiguration } from './constants/engine';
import { outputSizePresetGroups } from './constants/export';
import { designPalettePresets } from './constants/palettes';
import { realTerrainBounds, realTerrainPresets } from './constants/real-terrain';
import { getDesignUrl, parseDesignParameters, validateDesignSettings } from './design-settings';
import { createOutputRenderer } from './export/image-export';
import { createNodeExportFile } from './export/node-image-export';
import { loadNodeRealTerrain } from './node-real-terrain';
import { createRandomPalette } from './random-palette';
import type { DesignSettings, ValidatedDesignSettings } from './types/design';
import type { RealTerrain } from './real-terrain';

const cliConfigVersion = 1;
const browserBaseUrl = 'https://conorluddy.github.io/Topogra/';
const designKeys = Object.keys(versionOneDesignDefaults) as (keyof DesignSettings)[];
const booleanKeys = new Set<keyof DesignSettings>([
  'summitTrianglesEnabled',
  'summitCrossesEnabled',
  'cursorEnabled',
  'transparent',
  'allowExtraLargeExports',
]);
const designSettingDescriptions: Record<keyof DesignSettings, string> = {
  seed: 'An unsigned 32-bit value that fully determines generated terrain. Provide it when repeatability matters; if omitted, the CLI creates a new seed and reports it in diagnostics or JSON metadata.',
  gridStyle:
    'Adds a decorative, non-geographic overlay. Choose off for none, squares for corner marks, or crosses for centre marks; the same overlay appears in SVG and PNG.',
  gridSpacing:
    'Sets the grid’s repeated cell size in output pixels. It affects only squares and crosses, and does not change terrain sampling or contour geometry.',
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
    'Blends high-frequency noise into generated terrain while preserving the engine’s total amplitude. It is ignored by real terrain, whose elevations come from tiles.',
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
    'Selects 1× or 2× PNG rasterization. It doubles raster dimensions and pixel stroke widths at 2×; SVG ignores it.',
  transparent:
    'Removes the background rectangle while retaining contours, grid, markers, and attribution. PNG pixels outside artwork retain alpha zero.',
  allowExtraLargeExports:
    'Raises the maximum side from 4096 to 12288 pixels. It is an explicit memory-cost opt-in and still applies after PNG scaling.',
};

type TerrainConfig =
  | { mode: 'generated' }
  | {
      mode: 'real';
      latitude: number;
      longitude: number;
      spanKm: number;
      elevationFloor?: number;
      maxDepth?: number;
    };
interface CliConfig {
  version: number;
  settings: DesignSettings;
  terrain?: TerrainConfig;
}
type CliIo = Pick<typeof process, 'stdout' | 'stderr'>;
interface OutputSizePreset {
  value: string;
  label: string;
}

/** Runs the CLI and returns a stable process exit code for programmatic callers. */
export async function runCli(argv: string[], io: CliIo = process): Promise<number> {
  try {
    const [command = 'generate', ...argumentsList] = argv;

    if (command === '--help' || command === '-h') {
      return printHelp(io.stdout, argv.includes('--verbose'));
    }

    if (command === '--version') {
      return write(io.stdout, `topogra ${version}\n`);
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
      `topogra: ${error instanceof Error ? error.message : 'Unexpected failure.'}\n`,
    );

    return 2;
  }
}

/** Parses only known kebab-case flags, preserving explicit false and negative numbers. */
function parseOptions(argumentsList: string[]) {
  const values: Record<string, { type: 'string'; multiple?: boolean }> = {
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
    'elevation-floor': { type: 'string' },
    'max-depth': { type: 'string' },
    json: { type: 'string' },
    force: { type: 'string' },
    'save-config': { type: 'string' },
    attribution: { type: 'string' },
    'attribution-file': { type: 'string' },
  };

  for (const key of designKeys) {
    values[toKebab(key)] = { type: 'string' };
  }

  // Node treats a separate negative value as another option. Join only numeric
  // flags and numeric literals so unknown flags and missing values still fail.
  const numericFlags = new Set([
    'latitude',
    'longitude',
    'span-km',
    'elevation-floor',
    'max-depth',
    ...Object.keys(designNumberConstraints).map(toKebab),
  ]);
  const normalized: string[] = [];

  for (let index = 0; index < argumentsList.length; index++) {
    const argument = argumentsList[index];
    const next: string | undefined = argumentsList.at(index + 1);

    if (
      argument.startsWith('--') &&
      numericFlags.has(argument.slice(2)) &&
      next !== undefined &&
      /^-(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(next)
    ) {
      normalized.push(`${argument}=${next}`);
      index++;
    } else {
      normalized.push(argument);
    }
  }

  const { values: parsed, positionals } = parseArgs({
    args: normalized,
    options: values,
    allowPositionals: true,
    strict: true,
  });

  if (positionals.length) {
    throw new Error(`Unexpected argument "${positionals[0]}".`);
  }

  return parsed as Record<string, string | undefined>;
}

async function generateCommand(options: Record<string, string | undefined>, io: CliIo) {
  if (options.config !== undefined && options.url !== undefined) {
    throw new Error('--config and --url are mutually exclusive.');
  }

  let terrain: TerrainConfig = { mode: 'generated' };
  let source: Partial<DesignSettings> = {};

  if (options.config !== undefined) {
    ({ settings: source, terrain = terrain } = await readConfig(options.config));
  }

  if (options.url !== undefined) {
    source = readUrl(options.url);
  }

  if (options.palette !== undefined) {
    source = { ...source, ...readPalette(options.palette) };
  }

  if (options.size !== undefined) {
    source = { ...source, ...readSize(options.size) };
  }

  source = { ...source, ...readDesignFlags(options) };
  terrain = readTerrain(options, terrain);

  if (options['elevation-floor'] !== undefined) {
    if (terrain.mode !== 'real') {
      throw new Error('--elevation-floor requires real terrain.');
    }

    terrain = { ...terrain, elevationFloor: Number(options['elevation-floor']) };
  }

  if (options['max-depth'] !== undefined) {
    if (terrain.mode !== 'real') {
      throw new Error('--max-depth requires real terrain.');
    }

    terrain = { ...terrain, maxDepth: Number(options['max-depth']) };
  }

  validateTerrainConfig(terrain);

  source.seed ??= randomBytes(4).readUInt32BE();

  const validation = validateDesignSettings({ ...versionOneDesignDefaults, ...source });

  if (!validation.ok) {
    throw new Error(validation.error.message);
  }

  const settings = validation.data;

  const output =
    options.output ??
    `topogra-${settings.seed}-${settings.width * (settings.format === 'png' ? settings.pngScale : 1)}x${settings.height * (settings.format === 'png' ? settings.pngScale : 1)}.${settings.format}`;

  if (isEnabled(options, 'json') && output === '-') {
    throw new Error('--json cannot be combined with --output -.');
  }

  validateOutputExtension(output, settings.format);

  const destinations = [
    output === '-' ? undefined : output,
    options['save-config'],
    options['attribution-file'],
  ].filter((path): path is string => path !== undefined);

  if (new Set(destinations.map((path) => resolve(path))).size !== destinations.length) {
    throw new Error('Image, configuration, and attribution must use different output paths.');
  }

  for (const path of destinations) {
    await checkOutputDestination(path, isEnabled(options, 'force'));
  }

  const loadedTerrain =
    terrain.mode === 'real'
      ? await loadNodeRealTerrain(
          terrain.latitude,
          terrain.longitude,
          terrain.spanKm,
          terrain.elevationFloor,
          terrain.maxDepth,
        )
      : undefined;

  validateAttributionOptions(options, loadedTerrain);

  const result = createNodeExportFile(
    settings,
    createOutputRenderer(engineConfiguration, () => loadedTerrain),
  );

  if (!result.ok) {
    throw new Error(result.error.message);
  }

  const files: { path: string; bytes: Uint8Array }[] = [];

  if (options['save-config'] !== undefined) {
    files.push({
      path: options['save-config'],
      bytes: new TextEncoder().encode(
        `${JSON.stringify({ version: cliConfigVersion, settings, terrain }, null, 2)}\n`,
      ),
    });
  }

  if (options['attribution-file'] !== undefined && loadedTerrain !== undefined) {
    files.push({
      path: options['attribution-file'],
      bytes: new TextEncoder().encode(`${loadedTerrain.attribution}\n`),
    });
  }

  if (output !== '-') {
    files.push({ path: output, bytes: result.data.bytes });
  }

  await writeOutputFiles(files, isEnabled(options, 'force'));

  if (output === '-') {
    io.stdout.write(result.data.bytes);
  }

  if (isEnabled(options, 'json')) {
    write(
      io.stdout,
      `${JSON.stringify(metadata(result.data.filename, settings, terrain, loadedTerrain, output), null, 2)}\n`,
    );
  } else if (output !== '-') {
    write(io.stderr, `Generated ${output} (seed ${settings.seed}).\n`);
  }

  return 0;
}

function validateCommand(options: Record<string, string | undefined>, stdout: NodeJS.WriteStream) {
  if (options.config === undefined) {
    throw new Error('validate requires --config FILE.');
  }

  return readConfig(options.config).then(({ settings, terrain }) => {
    if (terrain !== undefined) {
      validateTerrainConfig(terrain);
    }

    const result = validateDesignSettings(settings);

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    write(stdout, 'Configuration is valid.\n');

    return 0;
  });
}

function printPresets(options: Record<string, string | undefined>, stdout: NodeJS.WriteStream) {
  const presets = {
    palettes: [...Object.keys(designPalettePresets), 'random'],
    sizes: getOutputSizePresets(),
    terrain: realTerrainPresets,
  };

  write(
    stdout,
    isEnabled(options, 'json')
      ? `${JSON.stringify(presets, null, 2)}\n`
      : `Palettes: ${presets.palettes.join(', ')}\nSizes: ${presets.sizes.map((preset) => preset.value).join(', ')}\nTerrain: ${presets.terrain.map((preset) => preset.name).join(', ')}\n`,
  );

  return 0;
}

function readDesignFlags(options: Record<string, string | undefined>): Partial<DesignSettings> {
  const settings: Partial<DesignSettings> = {};

  for (const key of designKeys) {
    const value = options[toKebab(key)];

    if (value === undefined) {
      continue;
    }

    (settings as Record<string, unknown>)[key] = booleanKeys.has(key)
      ? parseBoolean(value, toKebab(key))
      : key === 'pngScale' || key in designNumberConstraints
        ? Number(value)
        : value;
  }

  return settings;
}

function readUrl(value: string): Partial<DesignSettings> {
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

async function readConfig(path: string): Promise<CliConfig> {
  let config: unknown;

  try {
    config = JSON.parse(await readFile(path, 'utf8'));
  } catch {
    throw new Error(`Could not read configuration "${path}".`);
  }

  if (
    config === null ||
    typeof config !== 'object' ||
    (config as CliConfig).version !== cliConfigVersion ||
    !('settings' in config) ||
    Object.keys(config).some((key) => !['version', 'settings', 'terrain'].includes(key))
  ) {
    throw new Error(`Configuration must be a version ${cliConfigVersion} CLI envelope.`);
  }

  const settings = config.settings;

  if (
    settings === null ||
    typeof settings !== 'object' ||
    Object.keys(settings).some((key) => !designKeys.includes(key as keyof DesignSettings))
  ) {
    throw new Error('Configuration settings must contain only supported design fields.');
  }

  return config as CliConfig;
}

function readPalette(value: string): Partial<DesignSettings> {
  if (value === 'random') {
    return createRandomPalette();
  }

  if (!Object.hasOwn(designPalettePresets, value)) {
    throw new Error(`Unknown palette "${value}".`);
  }

  const preset = designPalettePresets[value as keyof typeof designPalettePresets];

  return preset;
}

function readSize(value: string): Partial<DesignSettings> {
  const preset = getOutputSizePresets().find((entry) => entry.value === value);

  if (!preset) {
    throw new Error(`Unknown output size "${value}".`);
  }

  const [width, height] = value.split('x').map(Number);

  return { width, height };
}

function getOutputSizePresets(): OutputSizePreset[] {
  return outputSizePresetGroups.flatMap((group) => [...group.presets]);
}

function readTerrain(
  options: Record<string, string | undefined>,
  current: TerrainConfig,
): TerrainConfig {
  const mode = options.terrain;

  if (mode !== undefined && mode !== 'generated' && mode !== 'real') {
    throw new Error('--terrain must be generated or real.');
  }

  const preset = options['terrain-preset'];

  if (preset !== undefined) {
    const place = realTerrainPresets.find(
      (entry) => entry.name.toLowerCase() === preset.toLowerCase(),
    );

    if (!place) {
      throw new Error(`Unknown terrain preset "${preset}".`);
    }

    return {
      mode: 'real',
      maxDepth: 0,
      latitude: place.latitude,
      longitude: place.longitude,
      spanKm: Number(options['span-km'] ?? realTerrainBounds.defaultSpanKm),
    };
  }

  if (mode === 'real' || options.latitude !== undefined || options.longitude !== undefined) {
    const latitude = Number(options.latitude);
    const longitude = Number(options.longitude);
    const spanKm = Number(options['span-km'] ?? realTerrainBounds.defaultSpanKm);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error('Real terrain requires --latitude and --longitude.');
    }

    return { mode: 'real', latitude, longitude, spanKm, maxDepth: 0 };
  }

  return mode === 'generated' ? { mode } : current;
}

/** Applies the browser's geographic bounds to command options and saved configurations. */
function validateTerrainConfig(terrain: TerrainConfig): void {
  if (terrain.mode === 'generated') {
    return;
  }

  if (
    terrain.maxDepth !== undefined &&
    (!Number.isFinite(terrain.maxDepth) || terrain.maxDepth < 0 || terrain.maxDepth > 11000)
  ) {
    throw new Error('Maximum depth must be between 0 and 11000 meters.');
  }

  if (
    terrain.elevationFloor !== undefined &&
    (!Number.isFinite(terrain.elevationFloor) ||
      terrain.elevationFloor < -11000 ||
      terrain.elevationFloor > 8900)
  ) {
    throw new Error('Elevation floor must be between −11000 and 8900 meters.');
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
      'Use latitude −85 to 85, longitude −180 to 180, and an area width of 2–200 km.',
    );
  }
}

/** Avoids generating valid bytes under a misleading filename extension. */
function validateOutputExtension(output: string, format: DesignSettings['format']): void {
  if (output === '-') {
    return;
  }

  const extension = output.split('.').pop()?.toLowerCase();

  if (extension !== undefined && extension !== format) {
    throw new Error(`Output extension .${extension} conflicts with --format ${format}.`);
  }
}

function metadata(
  filename: string,
  settings: ValidatedDesignSettings,
  terrain: TerrainConfig,
  loadedTerrain: RealTerrain | undefined,
  output: string,
) {
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

/** Makes attribution delivery explicit while retaining embedded credits in standalone images. */
function validateAttributionOptions(
  options: Record<string, string | undefined>,
  terrain: RealTerrain | undefined,
): void {
  const mode = options.attribution;

  if (mode !== undefined && mode !== 'embedded') {
    throw new Error('--attribution currently supports only embedded.');
  }

  if (options['attribution-file'] !== undefined && terrain === undefined) {
    throw new Error('--attribution-file requires real terrain.');
  }
}

/** Stages every output before publishing; restores prior files if publishing fails. */
async function writeOutputFiles(files: { path: string; bytes: Uint8Array }[], force: boolean) {
  const staged: { target: string; temporary: string; previous?: Buffer; committed: boolean }[] = [];

  try {
    for (const file of files) {
      const target = resolve(file.path);

      await checkOutputDestination(target, force);
      let previous: Buffer | undefined;

      if (force) {
        try {
          previous = await readFile(target);
        } catch (error) {
          if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
            throw error;
          }
        }
      }

      const temporary = `${target}.topogra-${process.pid}-${randomBytes(6).toString('hex')}.tmp`;

      staged.push({ target, temporary, previous, committed: false });
      await writeFile(temporary, file.bytes, { flag: 'wx' });
    }

    for (const file of staged) {
      // A hard link refuses a destination created after preflight, unlike rename.
      if (force) {
        await rename(file.temporary, file.target);
      } else {
        await link(file.temporary, file.target);
      }

      file.committed = true;
    }
  } catch (error) {
    for (const file of staged.filter((file) => file.committed).reverse()) {
      if (file.previous !== undefined) {
        await writeFile(file.target, file.previous);
      } else {
        await unlink(file.target);
      }
    }

    throw error;
  } finally {
    await Promise.all(staged.map((file) => unlink(file.temporary).catch(() => undefined)));
  }
}

async function checkOutputDestination(path: string, force: boolean) {
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
}

function parseBoolean(value: string, flag: string) {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw new Error(`--${flag} must be true or false.`);
}

/** Requires explicit boolean values for CLI control flags. */
function isEnabled(options: Record<string, string | undefined>, key: 'force' | 'json'): boolean {
  const value = options[key];

  return value === undefined ? false : parseBoolean(value, key);
}

function toKebab(value: string) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function write(stream: NodeJS.WriteStream, value: string) {
  stream.write(value);

  return 0;
}

function printHelp(stdout: NodeJS.WriteStream, isVerbose = false) {
  return write(
    stdout,
    `Topogra CLI\n\nUsage: topogra generate [options]\n       topogra presets [--json true]\n       topogra validate --config design.json\n\nSources apply as defaults → config or URL → palette/size → explicit flags. --output - writes image bytes; --json true is incompatible with it. Existing files require --force true.\n\nGenerator options:\n  --config FILE | --url URL    Versioned CLI config or v=1 browser URL (mutually exclusive)\n  --palette NAME               ${[...Object.keys(designPalettePresets), 'random'].join(', ')}\n  --size WIDTHxHEIGHT          A listed output size; use presets --json true to discover values\n  --terrain generated|real     Real mode requires coordinates or --terrain-preset NAME\n  --latitude NUMBER --longitude NUMBER --span-km NUMBER\n  --max-depth NUMBER            Maximum depth below sea level in meters (new real designs: 0; 0–11000)\n  --elevation-floor NUMBER      Omit real terrain below this height in meters (optional; −11000–8900)\n  --format svg|png --output FILE|- --save-config FILE\n  --attribution embedded       Keep real-terrain credit visibly embedded (the default)\n  --attribution-file FILE      Write the resolved real-terrain credit alongside the image\n  --json true|false --force true|false\n\nDesign flags (default; range where applicable):\n${getDesignFlagReference(isVerbose)}\n${isVerbose ? '' : '\nUse --help --verbose for a full description of every design flag.\n'}`,
  );
}

/** Keeps help ranges and defaults in lockstep with the validated settings contract. */
function getDesignFlagReference(isVerbose: boolean): string {
  return designKeys
    .map((key) => {
      const range = Object.hasOwn(designNumberConstraints, key)
        ? (() => {
            const constraint = designNumberConstraints[key as keyof typeof designNumberConstraints];

            return `; ${constraint[0]}–${constraint[1]} step ${constraint[2]}`;
          })()
        : '';

      const reference = `  --${toKebab(key)} VALUE    ${String(versionOneDesignDefaults[key])}${range}`;

      return isVerbose ? `\n${reference}\n\n${designSettingDescriptions[key]}\n` : reference;
    })
    .join('\n');
}

// npm exposes package executables through symlinks; compare their resolved file URLs.
const executablePath = process.argv.at(1);

if (
  executablePath !== undefined &&
  import.meta.url === pathToFileURL(realpathSync(executablePath)).href
) {
  void runCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
