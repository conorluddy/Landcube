import { build } from 'vite';

// Separate from `vite build` so the dev-only page can never land in dist/.
await build({
  logLevel: 'warn',
  build: {
    outDir: 'dist-specimens',
    emptyOutDir: true,
    rollupOptions: { input: 'specimens.html' },
  },
});
