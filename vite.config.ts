import { defineConfig } from 'vite';

/** Keeps the built site portable across repository and custom-domain hosting. */
export default defineConfig({
  base: './',
});
