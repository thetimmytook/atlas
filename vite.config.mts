import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 8080,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    minify: false,
    sourcemap: true,
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: 'index',
    },
  },
});
