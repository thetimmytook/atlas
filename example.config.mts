import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    minify: false,
    sourcemap: true,
    outDir: 'dist/example',
    rolldownOptions: {
      input: fileURLToPath(new URL('./examples/index.html', import.meta.url)),
    },
  },
});
