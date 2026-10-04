import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

// React adds its configured JSX runtimes to the explicit dependency list.
// Keep the local runtime as source so it shares locale state and hot updates
// with StudioContext instead of creating an optimized second copy.
const localRuntime: Plugin = {
  name: 'studio-local-runtime',
  configResolved(config) {
    config.optimizeDeps.include = config.optimizeDeps.include?.filter(id => !id.startsWith('@studio/i18n/'));
  },
};

export default defineConfig(({ command, isPreview }) => ({
  plugins: [react({ jsxImportSource: '@studio/i18n' }), localRuntime, { name: 'studio-metadata', async transformIndexHtml(html) {
    const { readCatalogue, description } = await import('./scripts/studio-catalogue.mjs');
    const studio = await readCatalogue();
    return html.replaceAll('__STUDIO_DESCRIPTION__', description(studio)).replaceAll('__STUDIO_VERSION__', studio.version);
  } }],
  optimizeDeps: { exclude: ['@studio/i18n/jsx-runtime', '@studio/i18n/jsx-dev-runtime'] },
  resolve: { alias: { '@studio': fileURLToPath(new URL('./src', import.meta.url)) } },
  base: command === 'serve' && !isPreview ? '/' : (process.env.VITE_BASE_PATH || '/brainsweatstudios/'),
  build: { target: 'es2022', sourcemap: false },
  // Long deterministic searches share CPU with world-family generation. Keep
  // the runner bounded on two-core CI hosts without relaxing test deadlines.
  test: { include: ['tests/*.test.ts'], environment: 'node', maxWorkers: 2 },
}));
