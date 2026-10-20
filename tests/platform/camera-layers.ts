import { expect } from 'vitest';

import { clearEvents, clickCount, clickIdentity, clickMap, openExample, openP } from './browser.js';

import type { Scenario } from './browser.js';

export const CAMERA_LAYERS: Scenario[] = [
  {
    id: 'ENV-02 / CAM-02 / zero size, resize, compact layout',
    subcases: [
      'resize preserves camera',
      'zero viewport rejects conversion',
      'recovery preserves camera and picking',
      'compact Buildings layout',
    ],
    run: async ({ page, origin, check }): Promise<void> => {
      await openExample(page, origin);
      const camera = await page.evaluate(() => {
        const { map } = window.platform;
        map.camera.center = { x: 175, y: 95 };
        map.camera.zoom = 2;

        return { x: map.camera.center.x, y: map.camera.center.y, zoom: map.camera.zoom };
      });
      await page.setViewportSize({ width: 1000, height: 900 });
      await expect
        .poll(() => page.evaluate(() => window.platform.map.camera.viewport.width))
        .toBe(952);
      check(
        'resize preserves camera',
        await page.evaluate(() => {
          const { map } = window.platform;

          return { x: map.camera.center.x, y: map.camera.center.y, zoom: map.camera.zoom };
        }),
        camera,
      );
      await page.evaluate(() => {
        window.platform.map.style.cssText = 'display:block;width:0;height:0;border:0';
      });
      await expect
        .poll(() => page.evaluate(() => window.platform.map.camera.viewport.width))
        .toBe(0);
      check(
        'zero viewport rejects conversion',
        await page.evaluate(() => {
          try {
            window.platform.map.coordinates.mapToClient({ x: 60, y: 90 });
          } catch (error) {
            return (error as { code: string }).code;
          }

          return 'did not throw';
        }),
        'VIEWPORT_UNAVAILABLE',
      );
      await page.evaluate(() => {
        window.platform.map.removeAttribute('style');
      });
      await expect
        .poll(() => page.evaluate(() => window.platform.map.camera.viewport.width))
        .toBe(952);
      await clickMap(page, 60, 90);
      check(
        'recovery preserves camera and picking',
        (await clickIdentity(page, 'shared-zone', 'a-0')) &&
          (await page.evaluate(({ x, y, zoom }) => {
            const { camera } = window.platform.map;

            return camera.center.x === x && camera.center.y === y && camera.zoom === zoom;
          }, camera)),
      );
      await page.setViewportSize({ width: 390, height: 844 });
      await expect
        .poll(() => page.evaluate(() => window.platform.map.camera.viewport.width))
        .toBe(366);
      check(
        'compact Buildings layout',
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      );
    },
  },
  {
    id: 'MOUSE-01/02 / native pan, suppression, anchored wheel',
    subcases: [
      'native drag changes camera without objectclick',
      'wheel changes zoom and preserves cursor anchor',
    ],
    run: async ({ page, origin, check }): Promise<void> => {
      await openP(page, origin);
      const start = await page.evaluate(() => {
        const { map } = window.platform;

        return {
          point: map.coordinates.mapToClient({ x: 170, y: 45 }),
          x: map.camera.center.x,
          y: map.camera.center.y,
        };
      });
      await clearEvents(page);
      await page.mouse.move(start.point.x, start.point.y);
      await page.mouse.down();
      await page.mouse.move(start.point.x + 70, start.point.y + 30, { steps: 5 });
      await page.mouse.up();
      check(
        'native drag changes camera without objectclick',
        await page.evaluate(({ x, y }) => {
          const { map, events, observations } = window.platform;
          observations.drag = {
            center: { x: map.camera.center.x, y: map.camera.center.y },
            events: events.slice(),
          };

          return (
            (map.camera.center.x !== x || map.camera.center.y !== y) &&
            !events.some(event => event.type === 'objectclick') &&
            events
              .filter(event => event.type === 'pointerdown' || event.type === 'pointerup')
              .every(event => event.trusted) &&
            events.some(event => event.type === 'release' && event.isClick === false)
          );
        }, start),
      );
      const before = await page.evaluate(() => {
        const { map, surface } = window.platform;
        const rect = surface.getBoundingClientRect();
        const client = { x: rect.x + rect.width * 0.37, y: rect.y + rect.height * 0.44 };

        return {
          client,
          anchor: map.coordinates.clientToMap(client),
          zoom: map.camera.zoom,
          scroll: window.scrollY,
        };
      });
      await page.mouse.move(before.client.x, before.client.y);
      await page.mouse.wheel(0, -120);
      await expect
        .poll(() => page.evaluate(() => window.platform.map.camera.zoom))
        .not.toBe(before.zoom);
      const after = await page.evaluate(client => {
        const { map } = window.platform;

        return {
          anchor: map.coordinates.clientToMap(client),
          zoom: map.camera.zoom,
          scroll: window.scrollY,
        };
      }, before.client);

      // 0.5 CSS px allows input-coordinate/raster rounding, independently of zoom.
      check(
        'wheel changes zoom and preserves cursor anchor',
        after.zoom > before.zoom &&
          Math.hypot(after.anchor.x - before.anchor.x, after.anchor.y - before.anchor.y) *
            after.zoom <
            0.5 &&
          before.scroll === after.scroll,
      );
    },
  },
  {
    id: 'COORD-01 / native picks after scroll and layout shift',
    subcases: [
      'scroll recomputes client coordinates and identity',
      'layout shift recomputes coordinates',
    ],
    run: async ({ page, origin, check }): Promise<void> => {
      await openP(page, origin);
      const before = await page.evaluate(() => {
        document.body.style.paddingBottom = '800px';

        return window.platform.map.coordinates.mapToClient({ x: 170, y: 45 });
      });
      await page.evaluate(() => window.scrollBy(0, 120));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(120);
      await clickMap(page, 170, 45);
      check(
        'scroll recomputes client coordinates and identity',
        (await clickIdentity(page, 'p-text', 'p-full')) &&
          (await page.evaluate(previous => {
            const { map, events, observations } = window.platform;
            const current = map.coordinates.mapToClient({ x: 170, y: 45 });
            const click = events.filter(event => event.type === 'objectclick').at(-1)!;
            observations.scroll = { previous, current, scroll: window.scrollY, click };

            return (
              Math.abs(current.y - previous.y + 120) < 0.1 &&
              Math.abs(click.mapPoint!.x - 170) * map.camera.zoom < 0.6 &&
              Math.abs(click.mapPoint!.y - 45) * map.camera.zoom < 0.6
            );
          }, before)),
      );
      await page.evaluate(() => {
        window.platform.map.style.marginTop = '80px';
      });
      await clearEvents(page);
      await clickMap(page, 170, 45);
      check('layout shift recomputes coordinates', await clickIdentity(page, 'p-text', 'p-full'));
    },
  },
  {
    id: 'LAYER-01/02/03 / Buildings floors and source context',
    subcases: [
      'independent floors and clipped polygon identity',
      'owned point preserves route context',
      'hidden layer is not pickable',
    ],
    run: async ({ page, origin, check }): Promise<void> => {
      await openExample(page, origin);
      await page.locator('#floor-a').selectOption('1');
      await expect
        .poll(() => page.locator('[data-layer-id="a-1"]').getAttribute('display'))
        .not.toBe('none');
      await clickMap(page, 60, 90);
      check(
        'independent floors and clipped polygon identity',
        (await clickIdentity(page, 'shared-zone', 'a-1')) &&
          (await page.evaluate(() => {
            const { layers } = window.platform;

            return (
              layers['a-1']!.visible &&
              !layers['a-0']!.visible &&
              layers['b-0']!.visible &&
              !layers['b-1']!.visible
            );
          })),
      );
      await clearEvents(page);
      await clickMap(page, 110, 165);
      check(
        'owned point preserves route context',
        await clickIdentity(page, 'a-stairs', 'a-1', 'journey'),
      );
      await page.evaluate(() => {
        window.platform.layers['a-1']!.visible = false;
      });
      await clearEvents(page);
      await clickMap(page, 60, 90);
      check('hidden layer is not pickable', await clickCount(page), 0);
    },
  },
];
