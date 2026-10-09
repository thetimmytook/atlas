import { mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';
import { preview } from 'vite';
import { expect, test } from 'vitest';

import type { Browser, Locator, Page } from 'playwright';

const DIAGNOSTICS_DIR = 'node_modules/.cache/e2e';
const DOM_TIMEOUT = 5_000;

async function checkBuildings(page: Page, origin: string): Promise<void> {
  await page.goto(`${origin}/examples/buildings.html`);
  const surface = page.locator('atlas-buildings svg');
  const zone = (layer: string): Locator =>
    surface.locator(`[data-layer-id="${layer}"] [data-object-id="shared-zone"] path`);
  const details = page.locator('#object-details');

  const clickZone = async (layer: string): Promise<void> => {
    const position = await zone(layer).evaluate(node => {
      const point = new DOMPoint(60, 90).matrixTransform((node as SVGPathElement).getScreenCTM()!);

      return { x: point.x, y: point.y };
    });
    await page.mouse.click(position.x, position.y);
  };

  await expect
    .poll(() => page.locator('#status').textContent())
    .toBe('Buildings loaded. Zone: base 1, height 4.');
  await expect.poll(() => zone('a-0').isVisible()).toBe(true);
  expect(await zone('b-0').isVisible()).toBe(true);
  expect(await zone('a-1').isVisible()).toBe(false);
  const lowerPath = await zone('a-0').getAttribute('d');
  await clickZone('a-0');
  expect(JSON.parse(await details.innerText())).toMatchObject({
    id: 'shared-zone',
    kind: 'polygon',
    layerId: 'a-0',
    baseZ: 1,
    height: 4,
  });
  await page.locator('#floor-a').selectOption('1');
  await expect.poll(() => zone('a-1').isVisible()).toBe(true);
  expect(await zone('b-0').isVisible()).toBe(true);
  expect(await zone('a-0').isVisible()).toBe(false);
  await clickZone('a-1');
  expect(JSON.parse(await details.innerText())).toMatchObject({
    id: 'shared-zone',
    layerId: 'a-1',
  });
  await page.getByRole('button', { name: 'Change zone height' }).click();
  await expect.poll(() => zone('a-1').count()).toBe(0);
  expect(await zone('b-0').isVisible()).toBe(true);
  expect(await zone('a-0').getAttribute('d')).toBe(lowerPath);
  await page.getByRole('button', { name: 'Change zone height' }).click();
  await expect.poll(() => zone('a-1').isVisible()).toBe(true);
  await page.getByRole('button', { name: 'Raise zone' }).click();
  await expect.poll(() => zone('b-0').count()).toBe(0);
  await page.locator('#floor-b').selectOption('1');
  await expect.poll(() => zone('b-1').isVisible()).toBe(true);
  const upperPath = await zone('a-1').getAttribute('d');
  const otherShape = await zone('b-1').elementHandle();
  await page.getByRole('button', { name: 'Move zone corner' }).click();
  await expect.poll(() => zone('a-1').getAttribute('d')).not.toBe(upperPath);
  expect(await zone('b-1').evaluate((node, previous) => node === previous, otherShape)).toBe(true);
  const routePoint = surface.locator('[data-layer-id="a-1"] [data-object-id="a-stairs"] circle');
  const bounds = (await routePoint.boundingBox())!;
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  expect(JSON.parse(await details.innerText())).toMatchObject({
    id: 'a-stairs',
    layerId: 'a-1',
    routeId: 'journey',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.locator('#floor-a').selectOption('0');
  expect(await zone('b-1').isVisible()).toBe(true);
}

async function clickCheckpoint(page: Page, layerId = 'second'): Promise<void> {
  const checkpoint = page.locator(
    `[data-layer-id="${layerId}"] [data-object-id="route-checkpoint"] circle`,
  );
  const bounds = await checkpoint.boundingBox();
  expect(bounds).not.toBeNull();

  // SVG symbols disable pointer events; a real mouse click reaches the map surface.
  await page.mouse.click(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
}

test('built Factory and Buildings examples load, pick and update across independent floors', async () => {
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
      const checkpoint = surface.locator(
        '[data-layer-id="second"] [data-object-id="route-checkpoint"]',
      );
      const route = surface.locator(
        '[data-layer-id="second"] [data-object-id="demo-route"] polyline',
      );
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
        .toBe('72.5,80 60,90 45,100');
      expect(
        await surface
          .locator('[data-layer-id="first"] [data-object-id="demo-line-1"] line')
          .evaluate(node => ['x1', 'y1', 'x2', 'y2'].map(name => Number(node.getAttribute(name)))),
      ).toEqual([40, 45, 85, 70]);
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
          layerId: 'second',
          kind: 'point',
          routeId: 'demo-route',
          position: { x: 60, y: 90, z: 5 },
        });

      await page.getByRole('button', { name: 'Move route point', exact: true }).click();
      await expect
        .poll(() => checkpoint.getAttribute('transform'), { timeout: DOM_TIMEOUT })
        .toBe('translate(45 90)');
      await expect
        .poll(() => route.getAttribute('points'), { timeout: DOM_TIMEOUT })
        .toBe('65,80 45,90 37.5,100');
      await clickCheckpoint(page);
      await expect
        .poll(async () => JSON.parse(await details.innerText()) as unknown, {
          timeout: DOM_TIMEOUT,
        })
        .toMatchObject({
          id: 'route-checkpoint',
          layerId: 'second',
          kind: 'point',
          routeId: 'demo-route',
          position: { x: 45, y: 90, z: 5 },
        });
      await expect
        .poll(() =>
          surface
            .locator('[data-layer-id="first"] [data-object-id="demo-route"] polyline')
            .evaluateAll(nodes => nodes.map(node => node.getAttribute('points'))),
        )
        .toEqual(['85,70 65,80', '37.5,100 30,110']);
      await page.getByRole('button', { name: 'Change route height', exact: true }).click();
      await expect
        .poll(() =>
          surface.locator('[data-layer-id="second"] [data-object-id="route-checkpoint"]').count(),
        )
        .toBe(0);
      const lowerCheckpoint = surface.locator(
        '[data-layer-id="first"] [data-object-id="route-checkpoint"]',
      );
      const lowerRoute = surface.locator(
        '[data-layer-id="first"] [data-object-id="demo-route"] polyline',
      );
      await expect.poll(() => lowerCheckpoint.getAttribute('transform')).toBe('translate(45 90)');
      await expect.poll(() => lowerRoute.getAttribute('points')).toBe('85,70 45,90 30,110');
      const viewBeforeToggle = await surface.getAttribute('viewBox');
      await page.getByRole('button', { name: 'Toggle second layer', exact: true }).click();
      await expect
        .poll(() => surface.locator('[data-layer-id="second"]').getAttribute('display'))
        .toBe('none');
      await clickCheckpoint(page, 'first');
      await expect
        .poll(async () => JSON.parse(await details.innerText()) as unknown)
        .toMatchObject({
          id: 'route-checkpoint',
          layerId: 'first',
          routeId: 'demo-route',
        });
      expect(await surface.getAttribute('viewBox')).toBe(viewBeforeToggle);
      expect(await surface.locator('image').isVisible()).toBe(true);
      await page.getByRole('button', { name: 'Toggle second layer', exact: true }).click();
      await page.getByRole('button', { name: 'Change route height', exact: true }).click();
      await expect.poll(() => checkpoint.isVisible()).toBe(true);
      await clickCheckpoint(page);
      await expect
        .poll(async () => JSON.parse(await details.innerText()) as unknown)
        .toMatchObject({
          id: 'route-checkpoint',
          layerId: 'second',
          routeId: 'demo-route',
        });
      await checkBuildings(page, `http://127.0.0.1:${address.port}`);
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
