import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Exercise the tarball and npm's platform-specific executable wrapper outside the repository.
const repositoryDirectory = fileURLToPath(new URL('../', import.meta.url));
const packageMetadata = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
const npmExecutablePath = process.env.npm_execpath;

assert.ok(npmExecutablePath, 'Run this check with npm run test:package.');
const directory = await mkdtemp(join(tmpdir(), 'topogra package '));

try {
  runNpm(['pack', '--pack-destination', directory], repositoryDirectory, { HUSKY: '0' });
  const tarballPath = join(directory, `topogra-${packageMetadata.version}.tgz`);

  runNpm(['install', '--omit=dev', '--no-audit', '--no-fund', tarballPath]);
  const installedDirectory = join(directory, 'node_modules', 'topogra');

  assert.deepEqual((await readdir(installedDirectory)).sort(), [
    'LICENSE',
    'README.md',
    'dist-cli',
    'package.json',
  ]);
  assert.match(runTopogra(['--help']), /Usage: topogra generate/);
  assert.equal(runTopogra(['--version']), `topogra ${packageMetadata.version}\n`);

  for (const format of ['svg', 'png']) {
    const outputPath = join(directory, `terrain.${format}`);
    const metadata = JSON.parse(
      runTopogra([
        'generate',
        '--seed',
        '42',
        '--width',
        '320',
        '--height',
        '240',
        '--format',
        format,
        '--output',
        outputPath,
        '--json',
        'true',
      ]),
    );
    const image = await readFile(outputPath);

    assert.equal(metadata.settings.seed, 42);
    assert.equal(metadata.output, outputPath);

    if (format === 'svg') {
      assert.match(image.toString('utf8'), /viewBox="0 0 320 240"/);
    } else {
      assert.deepEqual(image.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      assert.equal(image.readUInt32BE(16), 320);
      assert.equal(image.readUInt32BE(20), 240);
    }
  }

  console.log(`Packed topogra@${packageMetadata.version}: help, version, SVG, and PNG passed.`);
} finally {
  await rm(directory, { recursive: true, force: true });
}

/** npm exec uses the installed bin wrapper, including .cmd shims on Windows. */
function runTopogra(argumentsList) {
  return runNpm(['exec', '--offline', '--', 'topogra', ...argumentsList]);
}

function runNpm(argumentsList, workingDirectory = directory, environment = {}) {
  return execFileSync(process.execPath, [npmExecutablePath, ...argumentsList], {
    cwd: workingDirectory,
    encoding: 'utf8',
    env: { ...process.env, ...environment },
    stdio: ['ignore', 'pipe', 'inherit'],
    timeout: 180_000,
  });
}
