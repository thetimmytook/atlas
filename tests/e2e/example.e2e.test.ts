import { mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';
import { preview } from 'vite';
import { expect, test } from 'vitest';

import type { Browser, Page } from 'playwright';

const DIAGNOSTICS_DIR = 'node_modules/.cache/e2e';
const DOM_TIMEOUT = 5_000;

async function clickCheckpoint(page: Page): Promise<void> {
  const checkpoint = page.locator('[data-object-id="route-checkpoint"] circle');
  const bounds = await checkpoint.boundingBox();
  expect(bounds).not.toBeNull();

  // SVG symbols disable pointer events; a real mouse click reaches the map surface.
  await page.mouse.click(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
}

test('built Factory example loads, zooms, picks and redraws a moved route point', async () => {
  await rm(DIAGNOSTICS_DIR, { recursive: true, force: true });
  await mkdir(DIAGNOSTICS_DIR, { recursive: true });
  const server = await preview({
    configFile: fileURLToPath(new URL('../../example.config.mts', import.meta.url)),
    preview: { host: '127.0.0.1', port: 0, strictPort: true, open: false },
  });
  let browser: Browser | undefined;

  try {
    const address = server.httpServer.address();

    if (!address || typeof address === 'string') {
      throw new Error('Preview server has no TCP address.');
    }

    browser = await chromium.launch({ timeout: 10_000 });
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    const page = await context.newPage();
    page.setDefaultTimeout(DOM_TIMEOUT);
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });

    try {
      await page.goto(`http://127.0.0.1:${address.port}/examples/`, { timeout: 10_000 });
      const status = page.locator('#status');
      const surface = page.locator('atlas-map svg');
      const checkpoint = surface.locator('[data-object-id="route-checkpoint"]');
      const route = surface.locator('[data-object-id="demo-route"] polyline');
      const details = page.locator('#object-details');

      // The loaded status follows background decoding; also wait for visible SVG output.
      await expect
        .poll(() => status.textContent(), { timeout: DOM_TIMEOUT })
        .toBe('Factory ground floor loaded.');
      await expect
        .poll(() => surface.locator('image').isVisible(), { timeout: DOM_TIMEOUT })
        .toBe(true);
      await expect.poll(() => checkpoint.isVisible(), { timeout: DOM_TIMEOUT }).toBe(true);
      await expect
        .poll(() => checkpoint.getAttribute('transform'), { timeout: DOM_TIMEOUT })
        .toBe('translate(60 90)');
      await expect
        .poll(() => route.getAttribute('points'), { timeout: DOM_TIMEOUT })
        .toBe('85,70 60,90 30,110');
      const initialViewBox = await surface.getAttribute('viewBox');
      expect(initialViewBox).not.toBeNull();
      const initialWidth = Number(initialViewBox!.split(' ')[2]);
      expect(initialWidth).toBeGreaterThan(0);

      await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
      await expect
        .poll(
          async () => {
            const viewBox = await surface.getAttribute('viewBox');

            return Number(viewBox?.split(' ')[2]);
          },
          { timeout: DOM_TIMEOUT },
        )
        .toBeCloseTo(initialWidth / 1.25, 5);

      await clickCheckpoint(page);
      await expect
        .poll(async () => JSON.parse(await details.innerText()) as unknown, {
          timeout: DOM_TIMEOUT,
        })
        .toMatchObject({
          id: 'route-checkpoint',
          kind: 'point',
          routeId: 'demo-route',
          position: { x: 60, y: 90 },
        });

      await page.getByRole('button', { name: 'Move route point', exact: true }).click();
      await expect
        .poll(() => checkpoint.getAttribute('transform'), { timeout: DOM_TIMEOUT })
        .toBe('translate(45 90)');
      await expect
        .poll(() => route.getAttribute('points'), { timeout: DOM_TIMEOUT })
        .toBe('85,70 45,90 30,110');
      await clickCheckpoint(page);
      await expect
        .poll(async () => JSON.parse(await details.innerText()) as unknown, {
          timeout: DOM_TIMEOUT,
        })
        .toMatchObject({
          id: 'route-checkpoint',
          kind: 'point',
          routeId: 'demo-route',
          position: { x: 45, y: 90 },
        });
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
      await context.tracing.stop();
    } catch (error) {
      const captures = await Promise.allSettled([
        page.screenshot({
          path: `${DIAGNOSTICS_DIR}/page.png`,
          fullPage: true,
          timeout: DOM_TIMEOUT,
        }),
        context.tracing.stop({ path: `${DIAGNOSTICS_DIR}/trace.zip` }),
        writeFile(
          `${DIAGNOSTICS_DIR}/errors.json`,
          JSON.stringify({ pageErrors, consoleErrors }, null, 2),
        ),
      ]);
      captures.forEach(result => {
        if (result.status === 'rejected') {
          console.warn('Unable to capture e2e diagnostic.', result.reason);
        }
      });
      throw error;
    }
  } finally {
    try {
      await browser?.close();
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.httpServer.close(error => {
          if (error) {
            reject(error);

            return;
          }

          resolve();
        });
      });
    }
  }
});
