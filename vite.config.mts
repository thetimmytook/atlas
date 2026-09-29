import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

import packageJson from './package.json' with { type: 'json' };

export default defineConfig({
  plugins: [
    dts({
      tsconfigPath: './tsconfig.build.json',
      bundleTypes: true,
      aliases: Object.entries(packageJson.imports).map(([pattern, target]) => ({
        find: pattern.replace('/*.js', ''),
        replacement: fileURLToPath(new URL(target.replace('/*.ts', ''), import.meta.url)),
      })),
    }),
  ],
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
