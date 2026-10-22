import { access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { arch, platform, release } from 'node:os';
import { join } from 'node:path';

import { chromium, firefox, webkit } from 'playwright';
import { preview } from 'vite';
import { afterAll, beforeAll, expect, test } from 'vitest';

import { buildHashes, captureBuild, inputHashes, sha256, writeJson } from './evidence.js';
import { installViewportDiagnostics } from './initial-viewport-diagnostics.js';
import { captureViewportPostmortem } from './initial-viewport-postmortem.js';
import { SCENARIOS } from './scenarios.js';

import type { MapElement } from '#components/map-element/map-element.js';
import type { Scenario } from './browser.js';
import type { ScenarioResult, Status } from './evidence.js';
import type { ViewportPostmortemMode } from './initial-viewport-postmortem.js';
import type { Browser, BrowserContext, Page } from 'playwright';
import type { PreviewServer } from 'vite';

const VIEWPORT = { width: 1280, height: 1000 };
const ENGINES = [chromium, firefox, webkit];
const POSTMORTEM_MODE = process.env.ATLAS_VIEWPORT_POSTMORTEM as ViewportPostmortemMode | undefined;
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
  if (
    POSTMORTEM_MODE &&
    (!['passive', 'activate', 'screenshot'].includes(POSTMORTEM_MODE) ||
      process.env.ATLAS_VIEWPORT_DIAGNOSTICS !== '1')
  ) {
    throw new Error('Viewport post-mortem requires a supported mode and viewport diagnostics.');
  }

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
      const probe = await page.evaluate(() => {
        const map =
          window.platform?.map ?? document.querySelector<MapElement>('atlas-map, atlas-buildings');
        const surface = map?.shadowRoot?.querySelector('svg:not([aria-hidden])');

        return {
          events: window.platform?.eventHistory,
          observations: {
            ...window.platform?.observations,
            finalViewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
            finalMapViewport: map?.camera.viewport,
            host: map?.getBoundingClientRect().toJSON() as unknown,
            surface: surface?.getBoundingClientRect().toJSON() as unknown,
            connected: map?.isConnected,
            ready: document.readyState,
            visibility: document.visibilityState,
            viewportDiagnostics: window.viewportDiagnostics,
          },
        };
      });
      result.events = probe.events;
      result.observations = probe.observations;
    }

    // Post-mortem modes isolate their one intervention; do not add a later screenshot.
    if (result.status === 'fail' && page && !result.artifacts?.postmortem) {
      await page.screenshot({ path: `${prefix}.png`, fullPage: true, timeout: 5_000 });
      result.artifacts = { ...result.artifacts, screenshot: `${prefix}.png` };
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

async function saveFailedViewport(
  page: Page,
  prefix: string,
  mode: ViewportPostmortemMode,
  result: ScenarioResult,
): Promise<void> {
  result.artifacts = { postmortem: `${prefix}-postmortem.json` };

  try {
    Object.assign(result.artifacts, await captureViewportPostmortem(page, prefix, mode));
  } catch (error) {
    result.diagnostics.push({ kind: 'postmortem', message: String(error), expected: false });
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
  const startup = engine === 'webkit' && index === 1;
  const diagnostics = startup && process.env.ATLAS_VIEWPORT_DIAGNOSTICS === '1';
  const postmortemMode = startup ? POSTMORTEM_MODE : undefined;

  try {
    context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });

    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    tracing = true;

    // Opt-in, first Factory navigation only; ordinary platform runs add no wrappers.
    if (diagnostics) {
      await context.addInitScript(installViewportDiagnostics);
    }

    page = await context.newPage();

    page.setDefaultTimeout(5_000);
    page.setDefaultNavigationTimeout(10_000);
    observeErrors(page, result);
    await scenario.run({
      page,
      origin,
      expectedResourceUrls,
      captureFactoryStartup: diagnostics
        ? async (): Promise<void> => {
            await writeJson(
              join(capture.directory, 'webkit-1-factory-startup.json'),
              await page!.evaluate(() => ({
                events: window.viewportDiagnostics,
                nativeEvents: window.platform.eventHistory,
                observations: window.platform.observations,
                viewport: window.platform.map.camera.viewport,
                host: window.platform.map.getBoundingClientRect().toJSON() as unknown,
                surface: window.platform.surface.getBoundingClientRect().toJSON() as unknown,
                viewBox: window.platform.surface.getAttribute('viewBox'),
                connected: window.platform.map.isConnected,
                ready: document.readyState,
                visibility: document.visibilityState,
              })),
            );
          }
        : undefined,
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

    // Capture before finishScenario performs its geometry reads or failure screenshot.
    if (postmortemMode && page) {
      await saveFailedViewport(
        page,
        join(capture.directory, `${engine}-${index}`),
        postmortemMode,
        result,
      );
    }
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
