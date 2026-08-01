import { defineConfig } from 'vite'

export default defineConfig({
  // Relative base so the built site works from any GitHub Pages path
  // (user.github.io/repo-name/) without hardcoding the repo name.
  base: './',
  build: {
    target: 'esnext', // top-level await + WebGPU feature detection
    outDir: 'dist',
  },
  optimizeDeps: {
    // kokoro-js pulls in onnxruntime-web; let Vite pre-bundle it once
    // instead of re-resolving its wasm shims on every reload.
    exclude: ['onnxruntime-web'],
  },
  worker: {
    format: 'es',
  },
})
