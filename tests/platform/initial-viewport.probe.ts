import { createRequire } from 'node:module';
import { arch, platform, release } from 'node:os';
import { join } from 'node:path';

import { webkit } from 'playwright';
import { preview } from 'vite';
import { expect, test } from 'vitest';

import { openExample } from './browser.js';
import { buildHashes, captureBuild, inputHashes, writeJson } from './evidence.js';
import { installViewportDiagnostics } from './initial-viewport-diagnostics.js';
import { clickFactory } from './initial-viewport.js';

import type { MapElement } from '#components/map-element/map-element.js';
import type { Browser } from 'playwright';

// Not selected by test:platform. The opt-in .run.mjs selects this fixed 20-attempt
// test using the existing platform configuration and its exact readiness helper.
test('bounded WebKit initial viewport diagnostic matrix', async () => {
  const capture = await captureBuild();
  const runs: Record<string, unknown>[] = [];
  const require = createRequire(import.meta.url);
  const evidence = {
    build: capture.manifest,
    start: new Date().toISOString(),
    end: '',
    environment: {
      os: platform(),
      release: release(),
      arch: arch(),
      node: process.version,
      playwright: (require('playwright/package.json') as { version: string }).version,
      viewport: { width: 1280, height: 1000 },
      dpr: 1,
      headless: true,
    },
    plan: {
      processes: 10,
      contexts: 10,
      diagnostics: 'alternating, five of each group',
      retries: 0,
    },
    integrity: 'not checked',
    runs,
  };
  const server = await preview({
    configFile: false,
    root: capture.directory,
    build: { outDir: capture.frozen },
    preview: { host: '127.0.0.1', port: 0, strictPort: true, open: false },
  });
  const address = server.httpServer.address();

  if (!address || typeof address === 'string') {
    throw new Error('Viewport preview has no TCP address.');
  }

  const origin = `http://127.0.0.1:${address.port}`;
  console.info(`Viewport evidence: ${capture.directory}`);

  const attempt = async (browser: Browser, group: string, index: number): Promise<void> => {
    const diagnostics = index % 2 === 1;
    const errors: string[] = [];
    const result: Record<string, unknown> = {
      group,
      index,
      diagnostics,
      version: browser.version(),
      errors,
      status: 'fail',
    };
    const context = await browser.newContext({
      viewport: { width: 1280, height: 1000 },
      deviceScaleFactor: 1,
    });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });

    if (diagnostics) {
      await context.addInitScript(installViewportDiagnostics);
    }

    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    page.setDefaultNavigationTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });
    page.on('requestfailed', request =>
      errors.push(`${request.url()}: ${request.failure()?.errorText}`),
    );

    try {
      await openExample(page, origin, 'atlas-map');
      expect(await clickFactory(page)).toBe(true);
      expect(errors).toEqual([]);
      result.status = 'pass';
    } catch (error) {
      result.reason = String(error);
    } finally {
      result.state = await page.evaluate(() => {
        const map = document.querySelector<MapElement>('atlas-map');
        const surface = map?.shadowRoot?.querySelector('svg');

        return {
          host: map?.getBoundingClientRect().toJSON() as unknown,
          surface: surface?.getBoundingClientRect().toJSON() as unknown,
          viewport: map?.camera.viewport,
          viewBox: surface?.getAttribute('viewBox'),
          connected: map?.isConnected,
          ready: document.readyState,
          visibility: document.visibilityState,
          status: document.querySelector('#status')?.textContent,
          diagnostics: window.viewportDiagnostics,
        };
      });
      const prefix = join(capture.directory, `${group}-${index}`);
      await writeJson(`${prefix}.json`, result);
      await context.tracing.stop({ path: `${prefix}.zip` });
      await context.close();
      runs.push(result);
      await writeJson(join(capture.directory, 'viewport-results.json'), evidence);
      console.info(`${group} ${index} diagnostics=${diagnostics}: ${String(result.status)}`);
    }
  };

  try {
    for (let index = 0; index < 10; index++) {
      const browser = await webkit.launch({ headless: true, timeout: 10000 });

      try {
        await attempt(browser, 'process', index);
      } finally {
        await browser.close();
      }
    }

    const browser = await webkit.launch({ headless: true, timeout: 10000 });

    try {
      for (let index = 0; index < 10; index++) {
        await attempt(browser, 'context', index);
      }
    } finally {
      await browser.close();
    }

    expect(await inputHashes()).toEqual(capture.manifest.inputs);
    expect(await buildHashes(capture.frozen)).toEqual(capture.manifest.buildFiles);
    expect(await buildHashes('dist/example')).toEqual(capture.manifest.buildFiles);
    evidence.integrity = 'pass';
    expect(runs.filter(run => run.status !== 'pass')).toEqual([]);
  } finally {
    evidence.end = new Date().toISOString();
    await writeJson(join(capture.directory, 'viewport-results.json'), evidence);
    await server.close();
  }
});
