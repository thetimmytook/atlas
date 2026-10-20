import { access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { arch, platform, release } from 'node:os';
import { join } from 'node:path';

import { chromium, firefox, webkit } from 'playwright';
import { preview } from 'vite';
import { afterAll, beforeAll, expect, test } from 'vitest';

import { buildHashes, captureBuild, inputHashes, sha256, writeJson } from './evidence.js';
import { SCENARIOS } from './scenarios.js';

import type { Scenario } from './browser.js';
import type { ScenarioResult, Status } from './evidence.js';
import type { Browser, BrowserContext, Page } from 'playwright';
import type { PreviewServer } from 'vite';

const VIEWPORT = { width: 1280, height: 1000 };
const ENGINES = [chromium, firefox, webkit];
const require = createRequire(import.meta.url);
const results: {
  engine: string;
  version?: string;
  status: Status;
  executable: string;
  buildIdentity: string;
  reason?: string;
  scenarios: ScenarioResult[];
}[] = [];
let capture: Awaited<ReturnType<typeof captureBuild>>;
let server: PreviewServer | undefined;
let origin: string;
const integrity: { status: Status; reason?: string } = { status: 'not run' };

beforeAll(async () => {
  capture = await captureBuild();

  // Serve the captured production files, never the mutable dist/example directory.
  server = await preview({
    configFile: false,
    root: capture.directory,
    build: { outDir: capture.frozen },
    preview: { host: '127.0.0.1', port: 0, strictPort: true, open: false },
  });
  const address = server.httpServer.address();

  if (!address || typeof address === 'string') {
    throw new Error('Platform preview has no TCP address.');
  }

  origin = `http://127.0.0.1:${address.port}`;
  process.stdout.write(`Platform evidence: ${capture.directory}\n`);
});

async function saveResults(): Promise<void> {
  if (!capture) {
    return;
  }

  await writeJson(join(capture.directory, 'results.json'), {
    capturedAt: new Date().toISOString(),
    environment: {
      os: platform(),
      osVersion: release(),
      architecture: arch(),
      node: process.version,
      playwright: (require('playwright/package.json') as { version: string }).version,
      viewport: VIEWPORT,
      dpr: 1,
      headless: true,
      input: 'Playwright native mouse/wheel',
    },
    build: capture.manifest,
    frozen: capture.frozen,
    origin,
    results,
    integrity,
  });
}

afterAll(async () => {
  try {
    if (capture) {
      expect(await inputHashes()).toEqual(capture.manifest.inputs);
      expect(await buildHashes(capture.frozen)).toEqual(capture.manifest.buildFiles);
      expect(sha256(JSON.stringify(await buildHashes('dist/example')))).toBe(
        capture.manifest.buildIdentity,
      );
      integrity.status = 'pass';
    }
  } catch (error) {
    integrity.status = 'fail';
    integrity.reason = String(error);
    throw error;
  } finally {
    try {
      await saveResults();
    } finally {
      await server?.close();
    }
  }
});

function observeErrors(page: Page, result: ScenarioResult): void {
  page.on('pageerror', error =>
    result.diagnostics.push({ kind: 'page', message: error.message, expected: false }),
  );
  page.on('console', message => {
    if (message.type() === 'error') {
      result.diagnostics.push({
        kind: 'console',
        message: message.text(),
        url: message.location().url,
        expected: false,
      });
    }
  });
  page.on('requestfailed', request =>
    result.diagnostics.push({
      kind: 'resource',
      url: request.url(),
      message: request.failure()?.errorText ?? 'request failed',
      expected: false,
    }),
  );
  page.on('response', response => {
    if (response.status() >= 400) {
      result.diagnostics.push({
        kind: 'http',
        url: response.url(),
        message: String(response.status()),
        expected: false,
      });
    }
  });
}

async function finishScenario(
  context: BrowserContext | undefined,
  page: Page | undefined,
  result: ScenarioResult,
  prefix: string,
  tracing: boolean,
): Promise<void> {
  try {
    if (page && !page.isClosed()) {
      const probe = await page.evaluate(() => ({
        events: window.platform?.eventHistory,
        observations: {
          ...window.platform?.observations,
          finalViewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
          finalMapViewport: window.platform?.map.camera.viewport,
        },
      }));
      result.events = probe.events;
      result.observations = probe.observations;
    }

    if (result.status === 'fail' && page) {
      await page.screenshot({ path: `${prefix}.png`, fullPage: true, timeout: 5_000 });
      result.artifacts = { screenshot: `${prefix}.png` };
    }
  } catch (error) {
    result.status = 'fail';
    result.diagnostics.push({ kind: 'evidence', message: String(error), expected: false });
  } finally {
    try {
      if (tracing) {
        const trace = result.status === 'fail' ? `${prefix}.zip` : undefined;
        await context!.tracing.stop(trace ? { path: trace } : undefined);

        if (trace) {
          result.artifacts = { ...result.artifacts, trace };
        }
      }
    } catch (error) {
      result.status = 'fail';
      result.diagnostics.push({ kind: 'trace', message: String(error), expected: false });
    } finally {
      await context?.close();
    }
  }
}

async function runScenario(
  browser: Browser,
  engine: string,
  scenario: Scenario,
  index: number,
): Promise<ScenarioResult> {
  const result: ScenarioResult = {
    id: scenario.id,
    status: 'not run',
    checks: scenario.subcases.map(name => ({ name, status: 'not run' })),
    diagnostics: [],
  };
  const expectedResourceUrls: string[] = [];
  let context: BrowserContext | undefined;
  let page: Page | undefined;
  let tracing = false;

  try {
    context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    tracing = true;
    page = await context.newPage();
    page.setDefaultTimeout(5_000);
    page.setDefaultNavigationTimeout(10_000);
    observeErrors(page, result);
    await scenario.run({
      page,
      origin,
      expectedResourceUrls,
      check: (name, actual, expected = true) => {
        const assertion = result.checks.find(check => check.name === name);
        expect(assertion, `Unregistered subcase: ${name}`).toBeDefined();
        Object.assign(assertion!, { actual, expected, status: 'fail' });
        expect(actual, name).toEqual(expected);
        assertion!.status = 'pass';
      },
    });
    result.diagnostics.forEach(diagnostic => {
      diagnostic.expected = expectedResourceUrls.some(
        url => diagnostic.url === url || diagnostic.message.includes(url),
      );
    });
    expect(
      result.diagnostics.filter(diagnostic => !diagnostic.expected),
      'Unexpected browser diagnostics',
    ).toEqual([]);
    expect(
      result.checks.every(check => check.status === 'pass'),
      'Every registered subcase ran',
    ).toBe(true);
    result.status = 'pass';
  } catch (error) {
    result.status = 'fail';
    result.reason = error instanceof Error ? (error.stack ?? error.message) : String(error);
  } finally {
    await finishScenario(
      context,
      page,
      result,
      join(capture.directory, `${engine}-${index}`),
      tracing,
    );
  }

  console.info(`${engine}: ${result.status} ${scenario.id}`);

  return result;
}

for (const engine of ENGINES) {
  test(`portable production slice: ${engine.name()}`, async () => {
    const engineResult: (typeof results)[number] = {
      engine: engine.name(),
      status: 'not run',
      executable: engine.executablePath(),
      buildIdentity: capture.manifest.buildIdentity,
      scenarios: [],
    };
    results.push(engineResult);
    let browser: Browser | undefined;

    try {
      try {
        await access(engine.executablePath());
        browser = await engine.launch({ headless: true, timeout: 10_000 });
        engineResult.version = browser.version();
      } catch (error) {
        engineResult.status = 'blocked';
        engineResult.reason = String(error);
        engineResult.scenarios = SCENARIOS.map(scenario => ({
          id: scenario.id,
          status: 'blocked',
          reason: String(error),
          diagnostics: [],
          checks: scenario.subcases.map(name => ({ name, status: 'not run' })),
        }));
        throw error;
      }

      for (const scenario of SCENARIOS) {
        engineResult.scenarios.push(
          await runScenario(browser, engine.name(), scenario, engineResult.scenarios.length + 1),
        );
        await saveResults();
      }

      engineResult.status = engineResult.scenarios.every(result => result.status === 'pass')
        ? 'pass'
        : 'fail';
      expect(
        engineResult.scenarios
          .filter(result => result.status !== 'pass')
          .map(result => ({ id: result.id, reason: result.reason })),
      ).toEqual([]);
    } finally {
      try {
        await browser?.close();
      } finally {
        await saveResults();
      }
    }
  });
}
