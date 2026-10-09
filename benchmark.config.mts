import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

// Fixed git arguments from this config; no page or user input reaches the shell.
// eslint-disable-next-line sonarjs/no-os-command-from-path
const git = (...args: string[]): string => execFileSync('git', args, { encoding: 'utf8' }).trim();
const dirty = git('status', '--short', '--untracked-files=all');
const inputs = [
  'examples/prototype-bench.html',
  'examples/prototype-bench.ts',
  'examples/prototype-bench.scene.ts',
  'examples/prototype-bench.check.ts',
  'examples/prototype-bench.instrument.ts',
  'examples/prototype-bench.run.mjs',
  'examples/comparison.html',
  'examples/comparison.bench.ts',
  'examples/comparison.adapter.ts',
  'examples/comparison.leaflet.ts',
  'examples/comparison.expected.ts',
  'examples/comparison.instrument.ts',
  'examples/comparison.canvas.ts',
  'examples/comparison.canvas-fixtures.ts',
  'examples/comparison.canvas-controls.ts',
  'examples/stress.html',
  'examples/stress.bench.ts',
  'examples/stress.check.ts',
  'examples/stress.scene.ts',
  'examples/stress.instrument.ts',
  'benchmark.config.mts',
  'package.json',
  'package-lock.json',
  'examples/factory/Factory-ground-floor.svg',
  'tsconfig.json',
  'tsconfig.examples.json',
  'node_modules/leaflet/dist/leaflet-src.js',
  'node_modules/leaflet/dist/leaflet.css',
  ...readdirSync('src', { recursive: true })
    .filter((path): path is string => typeof path === 'string' && /\.(ts|html)$/.test(path))
    .map(path => `src/${path}`),
];

// Fixed allowlist of repository inputs above.
/* eslint-disable security/detect-non-literal-fs-filename */
const hashes = Object.fromEntries(
  inputs.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]),
);
/* eslint-enable security/detect-non-literal-fs-filename */

export default defineConfig({
  define: {
    __BENCH_BUILD__: JSON.stringify({ sourceCommit: git('rev-parse', 'HEAD'), dirty, hashes }),
    __PROTOTYPE_BENCH_BUILD__: JSON.stringify({
      sourceCommit: git('rev-parse', 'HEAD'),
      dirty,
      hashes: Object.fromEntries(
        Object.entries(hashes).filter(
          ([path]) =>
            path.startsWith('src/') ||
            path.includes('prototype-bench') ||
            [
              'benchmark.config.mts',
              'package.json',
              'package-lock.json',
              'tsconfig.json',
              'tsconfig.examples.json',
            ].includes(path),
        ),
      ),
    }),
  },
  server: { host: '127.0.0.1', port: 8081, strictPort: true },
  preview: { host: '127.0.0.1', port: 8081, strictPort: true },
  build: {
    target: 'es2022',
    minify: false,
    sourcemap: true,
    outDir: 'dist/benchmark',
    rolldownOptions: {
      input: {
        prototype: fileURLToPath(new URL('./examples/prototype-bench.html', import.meta.url)),
        baseline: fileURLToPath(new URL('./examples/stress.html', import.meta.url)),
        comparison: fileURLToPath(new URL('./examples/comparison.html', import.meta.url)),
      },
    },
  },
});
