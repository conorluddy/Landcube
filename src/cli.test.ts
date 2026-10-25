import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { engineConfiguration } from './constants/engine';
import { versionOneDesignDefaults } from './constants/design';
import { validateDesignSettings } from './design-settings';
import { createOutputRenderer } from './export/image-export';
import type { DesignSettings } from './types/design';

const executeFile = promisify(execFile);

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
