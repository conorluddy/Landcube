import { build } from 'esbuild';

// Use the API so the shebang and build options behave identically across shells.
await build({
  entryPoints: ['src/cli.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  external: ['@resvg/resvg-js', 'pngjs'],
  banner: { js: '#!/usr/bin/env node' },
  outfile: 'dist-cli/landcube.mjs',
});
