import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { test } from 'node:test';

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
