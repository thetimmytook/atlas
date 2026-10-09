/* global window -- Browser page.evaluate callbacks execute inside Chromium. */
/* eslint-disable security/detect-non-literal-fs-filename -- Local CLI paths and fixed build/source manifests, never page-supplied arbitrary paths. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const OUTPUT = option('--output', 'docs/performance/prototype-2026-10-09-before');
const CHECK_ONLY = args.includes('--check-only');
const OPTIONS = {
  warmups: Number(option('--warmups', '3')),
  repeats: Number(option('--repeats', '20')),
  instrumentRepeats: Number(option('--instrument-repeats', '3')),
};

if (
  !OUTPUT.startsWith('docs/performance/') ||
  OUTPUT.includes('..') ||
  Object.values(OPTIONS).some(value => !Number.isInteger(value) || value < 1)
) {
  throw new Error('Use a repository-relative docs/performance prefix and positive repeat counts.');
}

for (const suffix of [
  'manifest.json',
  'timing.csv',
  'timing-summary.csv',
  'instrument.csv',
  'instrument-summary.csv',
]) {
  let exists = true;

  try {
    await access(path.join(ROOT, `${OUTPUT}-${suffix}`));
  } catch {
    exists = false;
  }

  if (exists) {
    throw new Error('Output exists; choose a fresh prefix to preserve evidence.');
  }
}

const sha = value => createHash('sha256').update(value).digest('hex');

// Fixed git arguments; no input is passed to the shell.
// eslint-disable-next-line sonarjs/no-os-command-from-path
const git = (...values) => execFileSync('git', values, { cwd: ROOT, encoding: 'utf8' }).trim();
const commitBefore = git('rev-parse', 'HEAD');
const dirtyBefore = git('status', '--short', '--untracked-files=all');
const frozen = await mkdtemp(path.join(os.tmpdir(), 'atlas-prototype-frozen-'));
await cp(path.join(ROOT, 'dist/benchmark'), frozen, { recursive: true });

async function fileHashes(directory, prefix = '') {
  const files = (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const result = {};

  for (const file of files) {
    const relative = `${prefix}${file.name}`;
    const absolute = path.join(directory, file.name);

    if (file.isDirectory()) {
      Object.assign(result, await fileHashes(absolute, `${relative}/`));
    } else {
      result[relative] = sha(await readFile(absolute));
    }
  }

  return result;
}

async function verifySources(build) {
  const changed = [];

  for (const [file, expected] of Object.entries(build.hashes)) {
    if (sha(await readFile(path.join(ROOT, file))) !== expected) {
      changed.push(file);
    }
  }

  if (changed.length || git('rev-parse', 'HEAD') !== build.sourceCommit) {
    throw new Error(`Source/build changed; discard capture: ${changed.join(', ')}`);
  }
}

const builtHashes = await fileHashes(frozen);
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.map': 'application/json',
};
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const target = path.resolve(frozen, `.${pathname}`);

  if (!target.startsWith(`${frozen}${path.sep}`)) {
    response.writeHead(403).end();

    return;
  }

  void readFile(target)
    .then(contents => {
      response.writeHead(200, {
        'Content-Type': mime[path.extname(target)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      response.end(contents);
    })
    .catch(() => response.writeHead(404).end());
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const port = server.address().port;
const browser = await chromium.launch({ headless: true });
const errors = [];
const device = {
  systemLoadAverageAtStart: os.loadavg(),
  platform: process.platform,
  architecture: process.arch,
  osRelease: os.release(),
  cpuModel: os.cpus()[0]?.model,
  logicalCpus: os.cpus().length,
  memoryGiB: os.totalmem() / 1024 ** 3,
  browser: await browser.version(),
  headless: true,
  playwright: JSON.parse(
    await readFile(path.join(ROOT, 'node_modules/playwright/package.json'), 'utf8'),
  ).version,
  node: process.version,
  browserViewport: { width: 1100, height: 900 },
  deviceScaleFactor: 1,
};

async function openPage() {
  const page = await browser.newPage({ viewport: device.browserViewport, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/examples/prototype-bench.html`);
  await page.waitForFunction(() => window.prototypeBench !== undefined);

  return page;
}

function csv(rows) {
  const keys = Object.keys(rows[0]);
  const escape = value => `"${String(value).replaceAll('"', '""')}"`;

  return `${[keys.join(','), ...rows.map(row => keys.map(key => escape(row[key])).join(','))].join('\n')}\n`;
}

function summary(rows) {
  const groups = new Map();

  for (const row of rows) {
    const key = `${row.phase}/${row.roots}/${row.scenario}/${row.metric}`;
    const group = groups.get(key) ?? {
      phase: row.phase,
      roots: row.roots,
      scenario: row.scenario,
      metric: row.metric,
      unit: row.unit,
      values: [],
      repeats: new Set(),
    };
    group.values.push(row.value);
    group.repeats.add(row.repeat);
    groups.set(key, group);
  }

  return Array.from(groups.values(), group => {
    const values = group.values.sort((a, b) => a - b);
    const middle = Math.floor(values.length / 2);

    return {
      phase: group.phase,
      roots: group.roots,
      scenario: group.scenario,
      metric: group.metric,
      unit: group.unit,
      sample_count: values.length,
      repeat_count: group.repeats.size,
      median: values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2,
      p95: values[Math.ceil(values.length * 0.95) - 1],
      max: values.at(-1),
    };
  });
}

async function nativeChecks(page) {
  let anchor = await page.evaluate(() => window.prototypeBench.nativeSetup());
  await page.mouse.click(anchor.x, anchor.y);
  await page.evaluate(() => window.prototypeBench.nativeAssert('probe-route', 'b0-f0'));
  anchor = await page.evaluate(() => window.prototypeBench.nativeEdit());
  await page.mouse.click(anchor.x, anchor.y);
  await page.evaluate(() => window.prototypeBench.nativeAssert('probe-route', 'b0-f0'));
  anchor = await page.evaluate(() => window.prototypeBench.nativeFloor());
  await page.mouse.click(anchor.x, anchor.y);
  await page.evaluate(() => window.prototypeBench.nativeAssert('pr-1', 'b0-f1'));
  await page.evaluate(() => window.prototypeBench.nativeCleanup());

  return [
    'native component click: original root/layer',
    'native component click after vertex edit',
    'native component click after independent floor switch',
  ];
}

async function save(suffix, content) {
  const destination = path.join(ROOT, `${OUTPUT}-${suffix}`);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, content, { flag: 'wx' });
}

try {
  const checkPage = await openPage();
  const build = await checkPage.evaluate(() => window.prototypeBench.build);
  await verifySources(build);
  process.stdout.write('Frozen build verified; independent functional checks\n');
  const functional = await checkPage.evaluate(() => window.prototypeBench.check());
  const native = await nativeChecks(checkPage);
  await checkPage.close();
  const captures = [];

  if (!CHECK_ONLY) {
    for (const phase of ['timing', 'instrument']) {
      await verifySources(build);
      process.stdout.write(`Starting ${phase}: ${JSON.stringify(OPTIONS)}\n`);
      const page = await openPage();
      const capture = await page.evaluate(
        ({ phase, options }) => window.prototypeBench.run(phase, options),
        { phase, options: OPTIONS },
      );
      captures.push(capture);
      await page.close();
      await verifySources(build);
      process.stdout.write(`Completed ${phase}: ${capture.rows.length} raw rows\n`);
    }
  }

  if (errors.length) {
    throw new Error(`Browser errors: ${errors.join('; ')}`);
  }

  await verifySources(build);
  const manifest = {
    schema: 1,
    build,
    device,
    commitBefore,
    commitAfter: git('rev-parse', 'HEAD'),
    dirtyBefore,
    dirtyAfterCapture: git('status', '--short', '--untracked-files=all'),
    frozenBuildHashes: builtHashes,
    runtimeSha256: sha(
      JSON.stringify(
        Object.entries(build.hashes)
          .filter(([file]) => file.startsWith('src/'))
          .sort(),
      ),
    ),
    harnessSha256: sha(
      JSON.stringify(
        Object.entries(build.hashes)
          .filter(([file]) => !file.startsWith('src/'))
          .sort(),
      ),
    ),
    systemLoadAverageAtEnd: os.loadavg(),
    sourceVerification:
      'All recorded input hashes and HEAD matched before and after each phase. Immutable copied dist was served; no builds run by this runner.',
    functional,
    nativeChecks: native,
    pageErrors: errors,
    captures: captures.map(capture =>
      Object.fromEntries(Object.entries(capture).filter(([key]) => key !== 'rows')),
    ),
  };
  await save('manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);

  for (const capture of captures) {
    await save(`${capture.phase}.csv`, csv(capture.rows));
    await save(`${capture.phase}-summary.csv`, csv(summary(capture.rows)));
  }

  process.stdout.write(`Saved ${OUTPUT} (sanitized metadata; no host/user paths or machine IDs)\n`);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
  await rm(frozen, { recursive: true, force: true });
}
