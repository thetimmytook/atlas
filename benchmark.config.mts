import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

// Fixed git arguments from this config; no page or user input reaches the shell.
// eslint-disable-next-line sonarjs/no-os-command-from-path
const git = (...args: string[]): string => execFileSync('git', args, { encoding: 'utf8' }).trim();
const dirty = git('status', '--short', '--untracked-files=all');
const inputs = [
  'examples/stress.html',
  'examples/stress.bench.ts',
  'examples/stress.check.ts',
  'examples/stress.scene.ts',
  'examples/stress.instrument.ts',
  'benchmark.config.mts',
  'package.json',
  'package-lock.json',
  'examples/factory/Factory-ground-floor.svg',
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
  },
  server: { host: '127.0.0.1', port: 8081, strictPort: true },
  preview: { host: '127.0.0.1', port: 8081, strictPort: true },
  build: {
    target: 'es2022',
    minify: false,
    sourcemap: true,
    outDir: 'dist/benchmark',
    rolldownOptions: { input: fileURLToPath(new URL('./examples/stress.html', import.meta.url)) },
  },
});
