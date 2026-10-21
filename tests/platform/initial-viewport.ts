import { expect } from 'vitest';

import { clearEvents, clickIdentity, clickMap } from './browser.js';
import { installProbe } from './fixture.js';

import type { Scenario } from './browser.js';
import type { Page } from 'playwright';

async function expectViewport(page: Page, width: number, height: number): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const { map, surface } = window.platform;
        const rect = surface.getBoundingClientRect();

        return [map.camera.viewport.width, map.camera.viewport.height, rect.width, rect.height];
      }),
    )
    .toEqual([width, height, width, height]);
}

/** Compare public coordinate conversion with the actual SVG projection, before native input. */
async function factoryProjection(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const { map, surface, roots, observations } = window.platform;
        const route = roots['demo-route']!;

        if (
          route.kind !== 'route' ||
          !map.coordinates.available ||
          !surface.hasAttribute('viewBox')
        ) {
          return false;
        }

        const point = route.points[1]!;
        const client = map.coordinates.mapToClient(point.position);
        const roundTrip = map.coordinates.clientToMap(client);
        const circle = surface.querySelector<SVGCircleElement>(
          '[data-layer-id="second"] [data-object-id="route-checkpoint"] circle',
        )!;
        const rendered = new DOMPoint(0, 0).matrixTransform(circle.getScreenCTM()!);
        observations.initialProjection = {
          client,
          rendered: { x: rendered.x, y: rendered.y },
          roundTrip,
          host: map.getBoundingClientRect().toJSON() as unknown,
          surface: surface.getBoundingClientRect().toJSON() as unknown,
          viewport: map.camera.viewport,
        };

        return (
          map.coordinates.available &&
          circle.parentElement!.getAttribute('visibility') !== 'hidden' &&
          Math.hypot(client.x - rendered.x, client.y - rendered.y) < 0.1 &&
          Math.hypot(roundTrip.x - point.position.x, roundTrip.y - point.position.y) < 0.001
        );
      }),
    )
    .toBe(true);
}

export async function clickFactory(page: Page): Promise<boolean> {
  await factoryProjection(page);
  await clickMap(page, 60, 90);

  return clickIdentity(page, 'route-checkpoint', 'second', 'demo-route');
}

export const INITIAL_VIEWPORT: Scenario[] = ['zero', 'hidden'].map(mode => ({
  id: `ENV-01/02 / initially ${mode} Factory load and recovery`,
  subcases: [
    'load completes while initial viewport is zero',
    'show restores viewport SVG coordinates and native identity',
    'reconnect measures current size and preserves camera and native identity',
    'resize recovery preserves camera and native identity',
  ],
  run: async ({ page, origin, check }): Promise<void> => {
    // Only these dedicated zero/hidden cases alter initial layout. Ordinary ENV-01
    // continues to navigate the unchanged production document and Factory layout.
    await page.route(`${origin}/examples/`, async route => {
      const response = await route.fetch();
      const style = mode === 'zero' ? 'width:0;height:0' : 'display:none';
      const body = (await response.text()).replace('<atlas-map ', `<atlas-map style="${style}" `);
      await route.fulfill({ response, body });
    });
    await page.goto(`${origin}/examples/`);
    await expect.poll(() => page.locator('#status').textContent()).toContain('loaded.');
    await page.evaluate(installProbe, 'atlas-map');
    await expectViewport(page, 0, 0);
    check(
      'load completes while initial viewport is zero',
      await page.evaluate(() => {
        const { map } = window.platform;

        return map.definition !== undefined && !map.coordinates.available && map.objects.size > 0;
      }),
    );
    await page.evaluate(() => window.platform.map.removeAttribute('style'));
    await expectViewport(page, 800, 480);
    check('show restores viewport SVG coordinates and native identity', await clickFactory(page));
    const camera = await page.evaluate(() => {
      const { map } = window.platform;
      const camera = { x: map.camera.center.x, y: map.camera.center.y, zoom: map.camera.zoom };
      map.remove();
      map.style.width = '640px';
      map.style.height = '400px';

      return camera;
    });
    await page.evaluate(() => document.querySelector('.map-frame')!.append(window.platform.map));
    await expectViewport(page, 640, 400);
    await clearEvents(page);
    check(
      'reconnect measures current size and preserves camera and native identity',
      (await clickFactory(page)) &&
        (await page.evaluate(expected => {
          const { camera } = window.platform.map;

          return (
            camera.center.x === expected.x &&
            camera.center.y === expected.y &&
            camera.zoom === expected.zoom
          );
        }, camera)),
    );
    await page.evaluate(() => {
      window.platform.map.style.cssText = 'width:0;height:0';
    });
    await expectViewport(page, 0, 0);
    await page.evaluate(() => window.platform.map.removeAttribute('style'));
    await expectViewport(page, 800, 480);
    await clearEvents(page);
    check(
      'resize recovery preserves camera and native identity',
      (await clickFactory(page)) &&
        (await page.evaluate(expected => {
          const { camera } = window.platform.map;

          return (
            camera.center.x === expected.x &&
            camera.center.y === expected.y &&
            camera.zoom === expected.zoom
          );
        }, camera)),
    );
  },
}));
