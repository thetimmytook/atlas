/* global window -- page.evaluate callbacks execute in Chromium. */
/* eslint-disable security/detect-non-literal-fs-filename -- Local CLI evidence paths and build manifest. */
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SMOKE = process.argv.includes('--smoke');
const FIRST_SHOW = process.argv.includes('--first-show');
const OPTIONS = { warmups: 3, repeats: SMOKE ? 1 : 20, captures: SMOKE ? 1 : 3 };
const DIRECTORY = await mkdtemp(path.join(os.tmpdir(), 'atlas-zoom-'));
const FROZEN = path.join(DIRECTORY, 'build');
const sha = value => createHash('sha256').update(value).digest('hex');

// Fixed arguments only; no shell interpolation.
// eslint-disable-next-line sonarjs/no-os-command-from-path
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const save = (name, value) =>
  writeFile(path.join(DIRECTORY, name), `${JSON.stringify(value)}\n`, { flag: 'wx' });
const manifest = {
  schema: 1,
  start: new Date().toISOString(),
  options: OPTIONS,
  smoke: SMOKE,
  scenario: FIRST_SHOW ? 'first-show' : 'zoom',
  directory: DIRECTORY,
  commit: git('rev-parse', 'HEAD'),
  branch: git('branch', '--show-current'),
  dirty: git('status', '--short', '--untracked-files=all'),
  diffSha256: sha(git('diff', '--binary', 'HEAD')),
  checkpoints: [],
  errors: [],
  captures: [],
  runs: [],
  environment: {
    platform: process.platform,
    arch: process.arch,
    release: os.release(),
    osVersion: os.version(),
    cpu: os.cpus()[0].model,
    logicalCpus: os.cpus().length,
    memoryGiB: os.totalmem() / 1024 ** 3,
    node: process.version,
    playwright: JSON.parse(await readFile(path.join(ROOT, 'node_modules/playwright/package.json')))
      .version,
    headless: true,
    viewport: { width: 1100, height: 900 },
    deviceScaleFactor: 1,
    launch: 'Playwright default headless Chromium; no custom flags',
    throttling: 'No CPU/network throttling or forced GC',
    loadAverageStart: os.loadavg(),
  },
};
process.stdout.write(`Evidence: ${DIRECTORY}\n`);
await cp(path.join(ROOT, 'dist/benchmark'), FROZEN, { recursive: true });

async function hashes(directory, prefix = '') {
  const result = {};

  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const relative = `${prefix}${entry.name}`;
    const absolute = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      Object.assign(result, await hashes(absolute, `${relative}/`));
    } else {
      result[relative] = sha(await readFile(absolute));
    }
  }

  return result;
}

manifest.buildFiles = await hashes(FROZEN);

async function verify(boundary) {
  const changed = [];

  // Required capture/analysis inputs must not silently disappear from build metadata.
  for (const file of ['examples/prototype-zoom.run.mjs', 'examples/prototype-zoom.analyze.mjs']) {
    if (!Object.hasOwn(manifest.build.hashes, file)) {
      changed.push(`Missing input: ${file}`);
    }
  }

  for (const [file, expected] of Object.entries(manifest.build.hashes)) {
    if (sha(await readFile(path.join(ROOT, file))) !== expected) {
      changed.push(file);
    }
  }

  for (const directory of [FROZEN, path.join(ROOT, 'dist/benchmark')]) {
    if (JSON.stringify(await hashes(directory)) !== JSON.stringify(manifest.buildFiles)) {
      changed.push(directory);
    }
  }

  if (git('rev-parse', 'HEAD') !== manifest.commit) {
    changed.push('HEAD');
  }

  manifest.checkpoints.push({ boundary, timestamp: new Date().toISOString(), changed });

  if (changed.length) {
    throw new Error(`Inputs/build changed: ${changed.join(', ')}`);
  }
}

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.map': 'application/json' };
const server = createServer((request, response) => {
  const target = path.resolve(FROZEN, `.${new URL(request.url, 'http://localhost').pathname}`);

  if (!target.startsWith(`${FROZEN}${path.sep}`)) {
    response.writeHead(403).end();

    return;
  }

  void readFile(target)
    .then(bytes =>
      response.writeHead(200, { 'Content-Type': mime[path.extname(target)] }).end(bytes),
    )
    .catch(() => response.writeHead(404).end());
});
let browser;
let activePage;
let activeCdp;

async function traceStop(cdp, id) {
  const complete = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
  await cdp.send('Tracing.end');
  const { stream } = await complete;
  let data = '';

  try {
    while (true) {
      const chunk = await cdp.send('IO.read', { handle: stream });
      data += chunk.base64Encoded ? Buffer.from(chunk.data, 'base64').toString() : chunk.data;

      if (chunk.eof) {
        break;
      }
    }

    await writeFile(path.join(DIRECTORY, `${id}.trace.json`), data, { flag: 'wx' });
  } finally {
    await cdp.send('IO.close', { handle: stream });
  }
}

async function openPage() {
  const page = await browser.newPage({
    viewport: manifest.environment.viewport,
    deviceScaleFactor: 1,
  });
  activePage = page;
  page.on('pageerror', error => manifest.errors.push({ type: 'page', message: error.message }));
  page.on('console', message => {
    if (message.type() === 'error') {
      manifest.errors.push({ type: 'console', message: message.text() });
    }
  });
  page.on('requestfailed', request =>
    manifest.errors.push({ type: 'resource', url: request.url(), error: request.failure() }),
  );
  await page.goto(`http://127.0.0.1:${server.address().port}/examples/prototype-bench.html`);
  await page.waitForFunction(() => window.prototypeBench?.zoom);

  return page;
}

async function run(page, mode, roots, profile, repeat, measured, phase) {
  const id = measured
    ? `${mode}-${roots}-${profile}-${repeat}`
    : `${phase}-warmup-${roots}-${profile}-${repeat}`;
  const setup = await page.evaluate(
    ({ roots, profile, firstShow }) => window.prototypeBench.zoom.setup(roots, profile, firstShow),
    { roots, profile, firstShow: FIRST_SHOW },
  );
  let cdp;
  const record = {
    id,
    mode,
    roots,
    profile,
    repeat,
    measured,
    setup,
    start: new Date().toISOString(),
  };
  manifest.runs.push(record);

  if (mode === 'trace') {
    await verify(`${id}:before`);
    cdp = await page.context().newCDPSession(page);
    activeCdp = cdp;
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
    await cdp.send('Tracing.start', {
      categories:
        'devtools.timeline,v8,blink.user_timing,blink,cc,gpu,toplevel,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame',
      transferMode: 'ReturnAsStream',
    });
    await cdp.send('Profiler.start');
    manifest.captures.push({ id, status: 'started', cpuSamplingUs: 1000 });
  }

  const result = await page.evaluate(mode => window.prototypeBench.zoom.run(mode), mode);

  if (cdp) {
    const { profile: cpu } = await cdp.send('Profiler.stop');
    await save(`${id}.cpuprofile`, cpu);
    await traceStop(cdp, id);
    await cdp.detach();
    activeCdp = undefined;
    const capture = manifest.captures.at(-1);
    capture.status = 'pass';
    capture.files = {};

    for (const extension of ['trace.json', 'cpuprofile']) {
      const name = `${id}.${extension}`;
      const bytes = await readFile(path.join(DIRECTORY, name));
      capture.files[name] = { sha256: sha(bytes), bytes: bytes.length };
    }

    await verify(`${id}:after`);
  }

  record.finish = await page.evaluate(() => window.prototypeBench.zoom.finish());
  record.end = new Date().toISOString();
  record.result = measured ? result : undefined;
}

try {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  browser = await chromium.launch({ headless: true });
  manifest.environment.chromium = browser.version();
  const page = await openPage();
  manifest.build = await page.evaluate(() => window.prototypeBench.build);
  await verify('capture:before');
  await page.close();

  for (const mode of ['timing', 'trace', 'instrument']) {
    await verify(`${mode}:before`);
    const page = await openPage();

    for (const roots of [3000, 5000]) {
      const repeats = mode === 'timing' ? OPTIONS.repeats : OPTIONS.captures;

      for (let repeat = -OPTIONS.warmups; repeat < repeats; repeat++) {
        const profiles = ['control', 'materials-labels'];

        if ((repeat + OPTIONS.warmups) % 2) {
          profiles.reverse();
        }

        for (const profile of profiles) {
          // Warmups use clean timing mode, never tracing or prototype patches.
          await run(page, repeat < 0 ? 'timing' : mode, roots, profile, repeat, repeat >= 0, mode);
        }

        process.stdout.write(`${mode} ${roots} repeat ${repeat}\n`);
      }
    }

    await page.close();
    await verify(`${mode}:after`);
  }

  if (manifest.errors.length) {
    throw new Error('Browser errors recorded; inspect manifest.');
  }

  await verify('capture:after');
  manifest.status = 'pass';
} catch (error) {
  manifest.status = 'failed';
  manifest.failure = { message: error.message, stack: error.stack };
  process.exitCode = 1;

  if (activeCdp) {
    await activeCdp
      .send('Profiler.stop')
      .then(value => save('failed.cpuprofile', value.profile))
      .catch(() => {});
    await traceStop(activeCdp, 'failed').catch(() => {});
  }

  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: path.join(DIRECTORY, 'failed.png') }).catch(() => {});
  }
} finally {
  manifest.end = new Date().toISOString();
  manifest.environment.loadAverageEnd = os.loadavg();
  manifest.dirtyAfter = git('status', '--short', '--untracked-files=all');
  await save('raw.json', manifest);
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  process.stdout.write(`${manifest.status}: ${DIRECTORY}\n`);
}
