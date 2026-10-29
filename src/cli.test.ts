import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { version } from '../package.json';
import { engineConfiguration } from './constants/engine';
import { versionOneDesignDefaults } from './constants/design';
import { validateDesignSettings } from './design-settings';
import { createOutputRenderer } from './export/image-export';
import type { DesignSettings } from './types/design';

// Real-terrain fixtures must never read or fill the user's tile cache.
process.env.TOPOGRA_TILE_CACHE = 'off';

const executeFile = promisify(execFile);

void test('CLI reports the package version', async () => {
  const { stdout, stderr } = await runCommand(['--version']);

  assert.equal(stdout, `topogra ${version}\n`);
  assert.equal(stderr, '');
});

void test('CLI runs through an npm executable symlink in a path containing spaces', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'topogra npm bin '));
  const executable = join(directory, 'topogra.ts');

  await symlink(resolve('src/cli.ts'), executable);
  const { stdout, stderr } = await executeFile(process.execPath, [
    '--import',
    'tsx',
    executable,
    '--help',
  ]);

  assert.match(stdout, /topogra generate/);
  assert.equal(stderr, '');
});

/** Invokes the source entry point exactly as an installed CLI wrapper does. */
function runCommand(argumentsList: string[]) {
  return executeFile(process.execPath, ['--import', 'tsx', 'src/cli.ts', ...argumentsList]);
}

void test('CLI generates a resolved SVG and metadata through its process entry point', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'topogra-cli-'));
  const output = join(directory, 'terrain.svg');
  const { stdout, stderr } = await runCommand([
    'generate',
    '--seed',
    '42',
    '--width',
    '320',
    '--height',
    '240',
    '--output',
    output,
    '--json',
    'true',
  ]);

  assert.equal(stderr, '');
  assert.match(await readFile(output, 'utf8'), /viewBox="0 0 320 240"/);
  const metadata = JSON.parse(stdout) as {
    output: string;
    filename: string;
    settings: { seed: number };
  };

  assert.equal(metadata.output, output);
  assert.equal(metadata.filename, 'topogra-42-320x240.svg');
  assert.equal(metadata.settings.seed, 42);
});

void test('CLI help exposes canonical design defaults and numeric constraints', async () => {
  const { stdout } = await runCommand(['generate', '--help']);
  const verbose = await runCommand(['--help', '--verbose']);

  assert.match(stdout, /--seed VALUE\s+0; 0–4294967295 step 1/);
  assert.match(stdout, /--cursor-height VALUE\s+0.32; -0.6–0.6 step 0.02/);
  assert.doesNotMatch(stdout, /fully determines generated terrain/);
  assert.match(verbose.stdout, /fully determines generated terrain/);
  assert.match(verbose.stdout, /CLI exports are always settled static terrain/);
});

void test('CLI validates saved configuration, applies explicit overrides, and rejects incompatible stdout', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'topogra-cli-'));
  const config = join(directory, 'design.json');
  const output = join(directory, 'override.svg');

  await runCommand([
    'generate',
    '--seed',
    '17',
    '--width',
    '320',
    '--height',
    '240',
    '--palette',
    'Blueprint',
    '--save-config',
    config,
    '--output',
    join(directory, 'base.svg'),
  ]);
  const validation = await runCommand(['validate', '--config', config]);
  const savedConfig = JSON.parse(await readFile(config, 'utf8')) as { settings: DesignSettings };
  const override = await runCommand([
    'generate',
    '--config',
    config,
    '--line-color',
    '#ff0000',
    '--output',
    output,
    '--json',
    'true',
  ]);

  assert.match(validation.stdout, /valid/);
  assert.equal(
    (JSON.parse(override.stdout) as { settings: { lineColor: string } }).settings.lineColor,
    '#ff0000',
  );
  await assert.rejects(runCommand(['generate', '--output', '-', '--json', 'true']), /--json/);
  await writeFile(config, JSON.stringify({ version: 1, settings: { seed: 1 }, unexpected: true }));
  await assert.rejects(runCommand(['validate', '--config', config]), /version 1 CLI envelope/);
  await assert.rejects(
    runCommand(['generate', '--format', 'png', '--output', join(directory, 'incorrect.svg')]),
    /conflicts with --format/,
  );
  await assert.rejects(
    runCommand(['generate', '--attribution-file', join(directory, 'credits.txt')]),
    /requires real terrain/,
  );
  await writeFile(
    config,
    JSON.stringify({
      version: 1,
      settings: savedConfig.settings,
      terrain: { mode: 'real', latitude: 91, longitude: 0, spanKm: 25 },
    }),
  );
  await assert.rejects(runCommand(['generate', '--config', config]), /latitude/);
});

void test('CLI SVG output exactly matches the shared browser renderer across the parity matrix', async () => {
  const scenarios: Partial<DesignSettings>[] = [
    { seed: 42, width: 320, height: 240, indexStyle: 'solid', gridStyle: 'squares' },
    {
      seed: 84,
      width: 320,
      height: 240,
      transparent: true,
      indexStyle: 'alternating',
      summitMarkerSize: 'L',
      summitTrianglesEnabled: true,
      summitCrossesEnabled: true,
      cursorEnabled: false,
    },
  ];

  for (const [index, changes] of scenarios.entries()) {
    const directory = await mkdtemp(join(tmpdir(), 'topogra-cli-parity-'));
    const output = join(directory, `scenario-${index}.svg`);
    const settingsResult = validateDesignSettings({ ...versionOneDesignDefaults, ...changes });

    assert.ok(settingsResult.ok);
    const settings = settingsResult.data;
    const flags = Object.entries(settings).flatMap(([key, value]) => [toKebab(key), String(value)]);

    await runCommand(['generate', ...flags, '--output', output]);
    assert.equal(
      await readFile(output, 'utf8'),
      createOutputRenderer(engineConfiguration).getSvg(settings),
    );
  }
});

function toKebab(value: string): string {
  return `--${value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

void test('failed generation leaves no outputs and the same real-terrain command can be retried', async (context) => {
  const { runCli } = await import('./cli');
  const { access } = await import('node:fs/promises');
  const { PNG } = await import('pngjs');
  const directory = await mkdtemp(join(tmpdir(), 'topogra-retry-'));
  const output = join(directory, 'terrain.svg');
  const config = join(directory, 'terrain.json');
  const attribution = join(directory, 'terrain-attribution.txt');
  const args = [
    'generate',
    '--terrain',
    'real',
    '--latitude',
    '54.65',
    '--longitude=-8.7',
    '--width',
    '100',
    '--height',
    '100',
    '--output',
    output,
    '--save-config',
    config,
    '--attribution-file',
    attribution,
  ];
  const io = {
    stdout: { write: () => true },
    stderr: { write: () => true },
  } as unknown as Parameters<typeof runCli>[1];
  const fetchMock = context.mock.method(globalThis, 'fetch', () =>
    Promise.reject(new Error('offline')),
  );

  assert.equal(await runCli(args, io), 2);

  for (const path of [config, output, attribution]) {
    await assert.rejects(access(path));
  }

  const png = new PNG({ width: 256, height: 256 });

  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 128;
    png.data[i + 3] = 255;
  }

  const tile = PNG.sync.write(png);

  fetchMock.mock.mockImplementation(() => Promise.resolve(new Response(new Uint8Array(tile))));
  assert.equal(await runCli(args, io), 0);

  for (const path of [config, output, attribution]) {
    await access(path);
  }
});

void test('output conflicts and staging failures leave no companion config', async () => {
  const { access } = await import('node:fs/promises');
  const directory = await mkdtemp(join(tmpdir(), 'topogra-conflict-'));
  const config = join(directory, 'terrain.json');
  const output = join(directory, 'terrain.svg');

  await writeFile(output, 'existing');
  await assert.rejects(runCommand(['generate', '--output', output, '--save-config', config]));
  await assert.rejects(access(config));
  assert.equal(await readFile(output, 'utf8'), 'existing');
  await assert.rejects(
    runCommand([
      'generate',
      '--output',
      join(directory, 'missing', 'terrain.svg'),
      '--save-config',
      config,
    ]),
  );
  await assert.rejects(access(config));
  await assert.rejects(
    runCommand(['generate', '--output', output, '--save-config', output, '--force', 'true']),
  );
  assert.equal(await readFile(output, 'utf8'), 'existing');
});

void test('negative numeric arguments accept separate and equals forms', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'topogra-negative-'));
  const output = join(directory, 'terrain.svg');
  const config = join(directory, 'terrain.json');

  await runCommand([
    'generate',
    '--cursor-height',
    '-0.2',
    '--output',
    output,
    '--save-config',
    config,
  ]);
  const saved = JSON.parse(await readFile(config, 'utf8')) as {
    settings: { cursorHeight: number };
  };

  assert.equal(saved.settings.cursorHeight, -0.2);

  // Invalid span fails validation before network access, proving coordinates parsed.
  for (const coordinates of [
    ['--latitude', '-54.65', '--longitude', '-8.7'],
    ['--latitude=-54.65', '--longitude=-8.7'],
  ]) {
    await assert.rejects(
      runCommand(['generate', '--terrain', 'real', ...coordinates, '--span-km', '0']),
      (error: Error) => error.message.includes('area width of 2–800'),
    );
  }

  await assert.rejects(
    runCommand(['generate', '--longitude', '--unknown']),
    /ambiguous|argument|Unknown option/,
  );
});

void test('CLI validates elevation floors and keeps them in real-terrain configurations', async (context) => {
  const { runCli } = await import('./cli');
  const { PNG } = await import('pngjs');
  const directory = await mkdtemp(join(tmpdir(), 'topogra-floor-'));
  const output = join(directory, 'terrain.svg');
  const config = join(directory, 'terrain.json');
  const png = new PNG({ width: 256, height: 256 });

  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 128;
    png.data[i + 1] = 100;
    png.data[i + 3] = 255;
  }

  const tile = PNG.sync.write(png);

  context.mock.method(globalThis, 'fetch', () =>
    Promise.resolve(new Response(new Uint8Array(tile))),
  );
  const io = {
    stdout: { write: () => true },
    stderr: { write: () => true },
  } as unknown as Parameters<typeof runCli>[1];

  assert.equal(
    await runCli(
      [
        'generate',
        '--terrain',
        'real',
        '--latitude',
        '-54',
        '--longitude',
        '-8',
        '--elevation-floor',
        '-10',
        '--width',
        '100',
        '--height',
        '100',
        '--output',
        output,
        '--save-config',
        config,
      ],
      io,
    ),
    0,
  );
  const saved = JSON.parse(await readFile(config, 'utf8')) as {
    terrain: { elevationFloor: number; maxDepth?: number };
  };

  assert.equal(saved.terrain.elevationFloor, -10);
  assert.equal(saved.terrain.maxDepth, 0);
  const depthConfig = join(directory, 'depth.json');

  assert.equal(
    await runCli(
      [
        'generate',
        '--config',
        config,
        '--max-depth',
        '100',
        '--output',
        join(directory, 'depth.svg'),
        '--save-config',
        depthConfig,
      ],
      io,
    ),
    0,
  );
  const depth = JSON.parse(await readFile(depthConfig, 'utf8')) as {
    terrain: { maxDepth?: number };
  };

  assert.equal(depth.terrain.maxDepth, 100);
  delete saved.terrain.maxDepth;
  await writeFile(config, JSON.stringify(saved));
  const legacyConfig = join(directory, 'legacy.json');

  assert.equal(
    await runCli(
      [
        'generate',
        '--config',
        config,
        '--output',
        join(directory, 'legacy.svg'),
        '--save-config',
        legacyConfig,
      ],
      io,
    ),
    0,
  );
  const legacy = JSON.parse(await readFile(legacyConfig, 'utf8')) as {
    terrain: { maxDepth?: number };
  };

  assert.equal(legacy.terrain.maxDepth, undefined);

  assert.equal(await runCli(['validate', '--config', config], io), 0);
  assert.equal(
    await runCli(['generate', '--config', config, '--output', join(directory, 'restored.svg')], io),
    0,
  );
  await assert.rejects(
    runCommand(['generate', '--elevation-floor', '150']),
    /requires real terrain/,
  );
  await assert.rejects(
    runCommand([
      'generate',
      '--terrain',
      'real',
      '--latitude',
      '54',
      '--longitude=-8',
      '--elevation-floor',
      '9000',
    ]),
    /Elevation floor/,
  );
});

void test('terrain presets use suggested spans while explicit spans override them', async (context) => {
  const { runCli } = await import('./cli');
  const { PNG } = await import('pngjs');
  const directory = await mkdtemp(join(tmpdir(), 'topogra-presets-'));
  const png = new PNG({ width: 256, height: 256 });

  for (let offset = 0; offset < png.data.length; offset += 4) {
    png.data[offset] = 128;
    png.data[offset + 3] = 255;
  }

  const tile = PNG.sync.write(png);

  context.mock.method(globalThis, 'fetch', () =>
    Promise.resolve(new Response(new Uint8Array(tile))),
  );
  const io = {
    stdout: { write: () => true },
    stderr: { write: () => true },
  } as unknown as Parameters<typeof runCli>[1];

  for (const [name, override, expected] of [
    ['Ibiza — Es Vedrà', undefined, 4],
    ['Ibiza', '30', 30],
    ['Wicklow Mountains', undefined, 25],
  ] as const) {
    const config = join(directory, `${expected}.json`);
    const args = [
      'generate',
      '--terrain-preset',
      name,
      '--width',
      '100',
      '--height',
      '100',
      '--output',
      join(directory, `${expected}.svg`),
      '--save-config',
      config,
    ];

    if (override !== undefined) {
      args.push('--span-km', override);
    }

    assert.equal(await runCli(args, io), 0);
    const saved = JSON.parse(await readFile(config, 'utf8')) as { terrain: { spanKm: number } };

    assert.equal(saved.terrain.spanKm, expected);
  }
});

void test('physical contour intervals round-trip through CLI configs and old configs retain density', async (context) => {
  const { runCli } = await import('./cli');
  const { PNG } = await import('pngjs');
  const directory = await mkdtemp(join(tmpdir(), 'topogra-interval-'));
  const tile = new PNG({ width: 256, height: 256 });

  for (let i = 0; i < tile.data.length; i += 4) {
    const encoded = 32768 + ((i / 4) % 256) * 2;

    tile.data[i] = Math.floor(encoded / 256);
    tile.data[i + 1] = encoded % 256;
    tile.data[i + 3] = 255;
  }

  context.mock.method(globalThis, 'fetch', () =>
    Promise.resolve(new Response(new Uint8Array(PNG.sync.write(tile)))),
  );
  let diagnostics = '';
  const io = {
    stdout: { write: () => true },
    stderr: {
      write: (text: string) => {
        diagnostics += text;

        return true;
      },
    },
  } as unknown as Parameters<typeof runCli>[1];
  const output = join(directory, 'fixed.svg');
  const config = join(directory, 'fixed.json');

  assert.equal(
    await runCli(
      [
        'generate',
        '--terrain-preset',
        'Wicklow Mountains',
        '--seed',
        '123',
        '--width',
        '100',
        '--height',
        '100',
        '--contour-interval',
        '25',
        '--output',
        output,
        '--save-config',
        config,
      ],
      io,
    ),
    0,
    diagnostics,
  );
  const saved = JSON.parse(await readFile(config, 'utf8')) as {
    terrain: { contourInterval?: number | string };
  };
  const svg = await readFile(output, 'utf8');

  assert.equal(saved.terrain.contourInterval, 25);
  assert.match(svg, /data-contour-interval-m="25"/);
  assert.equal(
    await runCli(['generate', '--config', config, '--output', join(directory, 'restored.svg')], io),
    0,
    diagnostics,
  );
  assert.equal(await readFile(join(directory, 'restored.svg'), 'utf8'), svg);
  assert.equal(
    await runCli(
      [
        'generate',
        '--config',
        config,
        '--contour-interval',
        'auto',
        '--output',
        join(directory, 'auto.svg'),
      ],
      io,
    ),
    0,
    diagnostics,
  );
  assert.match(await readFile(join(directory, 'auto.svg'), 'utf8'), /data-contour-interval-m="20"/);
  delete saved.terrain.contourInterval;
  await writeFile(config, JSON.stringify(saved));
  assert.equal(
    await runCli(['generate', '--config', config, '--output', join(directory, 'legacy.svg')], io),
    0,
    diagnostics,
  );
  assert.doesNotMatch(
    await readFile(join(directory, 'legacy.svg'), 'utf8'),
    /data-contour-interval-m/,
  );

  for (const value of ['0', '-1', 'NaN', 'Infinity', '5001', 'fixed']) {
    assert.equal(
      await runCli(
        [
          'generate',
          '--config',
          config,
          '--contour-interval',
          value,
          '--output',
          join(directory, 'invalid.svg'),
        ],
        io,
      ),
      2,
    );
  }

  assert.equal(await runCli(['generate', '--contour-interval', '25'], io), 2);
});

void test('terrain detail defaults to high for new designs and standard for older configs', async (context) => {
  const { runCli } = await import('./cli');
  const { PNG } = await import('pngjs');
  const directory = await mkdtemp(join(tmpdir(), 'topogra-detail-'));
  const tile = new PNG({ width: 256, height: 256 });
  const requestedZooms = new Set<number>();

  context.mock.method(globalThis, 'fetch', (url: string) => {
    requestedZooms.add(Number(/\/terrarium\/(\d+)\//.exec(url)?.[1]));

    return Promise.resolve(new Response(new Uint8Array(PNG.sync.write(tile))));
  });
  const io = {
    stdout: { write: () => true },
    stderr: { write: () => true },
  } as unknown as Parameters<typeof runCli>[1];

  const generate = async (name: string, ...extra: string[]) => {
    const config = join(directory, `${name}.json`);

    requestedZooms.clear();
    assert.equal(
      await runCli(
        [
          'generate',
          ...extra,
          '--seed',
          '1',
          '--output',
          join(directory, `${name}.svg`),
          '--save-config',
          config,
        ],
        io,
      ),
      0,
    );

    return {
      zooms: [...requestedZooms],
      saved: JSON.parse(await readFile(config, 'utf8')) as {
        terrain: { terrainDetail?: string };
      },
    };
  };

  const high = await generate('high', '--terrain-preset', 'Errigal');

  assert.equal(high.saved.terrain.terrainDetail, 'high');
  assert.deepEqual(high.zooms, [13]);

  const standard = await generate(
    'standard',
    '--terrain-preset',
    'Errigal',
    '--terrain-detail',
    'standard',
  );

  assert.equal(standard.saved.terrain.terrainDetail, 'standard');
  assert.deepEqual(standard.zooms, [12]);

  // Configurations saved before detail levels existed keep their version-one terrain.
  const legacyConfig = join(directory, 'legacy-input.json');
  const legacyTerrain: Record<string, unknown> = { ...high.saved.terrain };

  delete legacyTerrain.terrainDetail;

  await writeFile(legacyConfig, JSON.stringify({ ...high.saved, terrain: legacyTerrain }));
  assert.deepEqual((await generate('legacy', '--config', legacyConfig)).zooms, [12]);

  await assert.rejects(
    runCommand(['generate', '--terrain-preset', 'Errigal', '--terrain-detail', 'ultra']),
    /Terrain detail must be standard, high, max/,
  );
  await assert.rejects(
    runCommand(['generate', '--terrain', 'generated', '--terrain-detail', 'high']),
    /--terrain-detail requires real terrain/,
  );
});
