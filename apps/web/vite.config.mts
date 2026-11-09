/// <reference types='vitest' />
import { defineConfig } from 'vite';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';

// FastAPI's address. The e2e run points it at its own API (API_ORIGIN); no VITE_
// prefix, so it never reaches the browser code.
const api = process.env.API_ORIGIN ?? 'http://localhost:8000';

// The API and the photos look like the same origin as the app, so the auth cookie
// needs no CORS setup (AD-15). An import waits on the AI engine for up to its timeout
// (30 s by default), so the proxy waits longer than the largest one (AD-43).
const proxy = {
  '/api/': { target: api, timeout: 120_000, proxyTimeout: 120_000 },
  '/media/': api,
};

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/web',
  server: {
    port: 4200,
    host: 'localhost',
    proxy,
  },
  // `vite preview` serves the built app (the e2e run), with the same proxy.
  preview: {
    port: 4300,
    host: 'localhost',
    proxy,
  },
  plugins: [
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    nxReadySignal(),
  ],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [],
  // },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  test: {
    name: 'web',
    watch: false,
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
