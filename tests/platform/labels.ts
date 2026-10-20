import { expect } from 'vitest';

import { clearEvents, clickCount, clickIdentity, labelTarget, openP } from './browser.js';

import type { LabelOrigin } from '#definitions/material-definition.js';
import type { Scenario } from './browser.js';

export const LABELS: Scenario[] = [
  {
    id: 'LABEL-01/03 / analytic attachments and native label-only context',
    subcases: [
      'independent four-kind clipped attachments and one route label',
      'native label-only object layer route identity',
      'direct membership priority',
      'polygon largest-cell fallback',
    ],
    run: async ({ page, origin, check }): Promise<void> => {
      await openP(page, origin);
      const placements = await page.evaluate(() => {
        const { map, surface, text, observations } = window.platform;
        const known: [string, string, number, number][] = [
          ['p-text', 'p-full', 170, 45],
          ['p-line', 'p-full', 80, 45],
          ['p-route', 'p-low', 90, 130],
          ['p-route', 'p-high', 150, 130],
          ['p-flat', 'p-full', 230, 25],
          ['p-volume', 'p-low', 300, 80],
          ['p-volume', 'p-high', 300, 80],
          ['p-owned', 'p-low', 30, 130],
        ];
        const values = known.map(([id, layer, x, y]) => {
          const rect = window.platform.bounds(text(id, layer));
          const attachment = map.coordinates.mapToClient({ x, y });

          return {
            id,
            layer,
            dx: rect.x - attachment.x,
            dy: rect.y - attachment.y,
            count: surface.querySelectorAll(
              `[data-layer-id="${layer}"] [data-object-id="${id}"] text`,
            ).length,
          };
        });
        observations.attachments = values;

        return (
          values.every(
            value => Math.abs(value.dx) < 0.5 && Math.abs(value.dy - 30) < 0.5 && value.count === 1,
          ) &&
          surface.querySelectorAll('[data-layer-id="p-low"] [data-object-id="p-route"] polyline')
            .length === 2
        );
      });
      check('independent four-kind clipped attachments and one route label', placements);
      await page.evaluate(() => {
        window.platform.layers['p-high']!.visible = false;
      });
      const identities: boolean[] = [];

      for (const [id, layer, route] of [
        ['p-text', 'p-full'],
        ['p-line', 'p-full'],
        ['p-route', 'p-low'],
        ['p-flat', 'p-full'],
        ['p-volume', 'p-low'],
        ['p-owned', 'p-low', 'p-route'],
      ]) {
        const target = await labelTarget(page, id!, layer);
        expect(
          target.proof,
          `${id}: label-only point is inside viewport/label and outside owner geometry`,
        ).toBe(true);
        await clearEvents(page);
        await page.mouse.click(target.x, target.y);
        identities.push(await clickIdentity(page, id!, layer!, route));
      }

      check('native label-only object layer route identity', identities.every(Boolean));
      await page.evaluate(() => {
        window.platform.layers['p-low']!.objectIds.add('p-route');
      });
      await expect
        .poll(() =>
          page.evaluate(() => {
            const { map, text } = window.platform;
            const attachment = map.coordinates.mapToClient({ x: 150, y: 130 });

            return (
              Math.abs(window.platform.bounds(text('p-route', 'p-low')).x - attachment.x) < 0.5
            );
          }),
        )
        .toBe(true);
      check(
        'direct membership priority',
        await page.evaluate(() => {
          const { roots, surface, observations } = window.platform;
          const route = roots['p-route']!;
          observations.directRoute =
            route.kind === 'route'
              ? route.points.map(point => ({ id: point.id, ...point.position }))
              : [];

          return (
            surface.querySelectorAll('[data-layer-id="p-low"] [data-object-id="p-route"] text')
              .length === 1 &&
            surface.querySelectorAll('[data-layer-id="p-low"] [data-object-id="p-route"] polyline')
              .length === 1
          );
        }),
      );
      await page.evaluate(() => {
        const { map, layers } = window.platform;
        layers['p-low']!.visible = false;
        layers['p-high']!.visible = false;
        Array.from(layers['p-full']!.objectIds).forEach(id =>
          layers['p-full']!.objectIds.remove(id),
        );
        const polygon = map.objects.add({
          id: 'fallback',
          kind: 'polygon',
          label: 'Fallback',
          baseZ: 9,
          contour: [
            [20, 20],
            [140, 20],
            [140, 140],
            [120, 140],
            [120, 60],
            [40, 60],
            [40, 140],
            [20, 140],
          ].map(([x, y]) => ({ x: x!, y: y! })),
        });
        layers['p-full']!.objectIds.add(polygon.id);
        window.platform.saveReferences();
      });
      await expect.poll(() => page.evaluate(() => !!window.platform.text('fallback'))).toBe(true);
      check(
        'polygon largest-cell fallback',
        await page.evaluate(() => {
          const { map, text, observations } = window.platform;

          // Known U-shape triangulation: first largest cell centroid, independent of runtime helper.
          const expected = map.coordinates.mapToClient({ x: 280 / 3, y: 100 / 3 });
          const actual = window.platform.bounds(text('fallback'));
          observations.fallback = { expected, actual: actual.toJSON() as unknown };

          return (
            Math.abs(actual.x - expected.x) < 0.5 && Math.abs(actual.y - expected.y - 30) < 0.5
          );
        }),
      );
    },
  },
  {
    id: 'LABEL-02/05 / origins, units, spaces, outline and typography',
    subcases: [
      'all nine origins',
      'px rem root font and zoom',
      'container family and literal horizontal spaces',
      'native leading-space halo and outside picking',
    ],
    run: async ({ page, origin, check }): Promise<void> => {
      await openP(page, origin);
      await page.evaluate(() => {
        window.platform.layers['p-low']!.visible = false;
        window.platform.layers['p-high']!.visible = false;
      });
      const origins: [LabelOrigin, number, number][] = [
        ['top left', 0, 0],
        ['top center', 0, 0.5],
        ['top right', 0, 1],
        ['center left', 0.5, 0],
        ['center center', 0.5, 0.5],
        ['center right', 0.5, 1],
        ['bottom left', 1, 0],
        ['bottom center', 1, 0.5],
        ['bottom right', 1, 1],
      ];
      const originResults: boolean[] = [];

      for (const [origin, vertical, horizontal] of origins) {
        await page.evaluate(origin => {
          window.platform.map.materials.get('labels')!.properties = {
            label: { origin, font: { size: '20px' }, offset: { x: '12px', y: '30px' } },
          };
        }, origin);
        await expect
          .poll(() =>
            page.evaluate(
              ({ vertical, horizontal }) => {
                const { map, text } = window.platform;
                const box = window.platform.bounds(text('p-text'));
                const attachment = map.coordinates.mapToClient({ x: 170, y: 45 });

                return (
                  Math.abs(box.x + horizontal * box.width - attachment.x - 12) < 0.5 &&
                  Math.abs(box.y + vertical * box.height - attachment.y - 30) < 0.5
                );
              },
              { vertical, horizontal },
            ),
          )
          .toBe(true);
        originResults.push(true);
      }

      check('all nine origins', originResults.length, 9);
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '24px';
        window.platform.map.materials.get('labels')!.properties = {
          label: { origin: 'top left', font: { size: '1rem' }, offset: { x: '1rem', y: '-1rem' } },
        };
      });
      await expect
        .poll(() => page.evaluate(() => window.platform.text('p-text').getAttribute('font-size')))
        .toBe('24');
      const units: boolean[] = [];

      for (const zoom of [1.5, 3]) {
        await page.evaluate(zoom => {
          window.platform.map.camera.zoom = zoom;
        }, zoom);
        await expect
          .poll(() =>
            page.evaluate(() => {
              const { map, text } = window.platform;
              const rect = window.platform.bounds(text('p-text'));
              const anchor = map.coordinates.mapToClient({ x: 170, y: 45 });

              return (
                Math.abs(rect.x - anchor.x - 24) < 0.5 && Math.abs(rect.y - anchor.y + 24) < 0.5
              );
            }),
          )
          .toBe(true);
        units.push(
          await page.evaluate(
            () => window.platform.text('p-text').getAttribute('font-size') === '24',
          ),
        );
      }

      check('px rem root font and zoom', units.every(Boolean));
      await page.evaluate(() => {
        const { map } = window.platform;
        map.style.fontFamily = 'serif';
        map.style.writingMode = 'vertical-rl';
        map.style.textTransform = 'uppercase';
        map.materials.get('labels')!.properties = {
          label: { origin: 'top left', font: { size: '20px' }, offset: { x: '0px', y: '30px' } },
        };
      });
      await expect
        .poll(() => page.evaluate(() => window.platform.text('p-text').getAttribute('font-family')))
        .toBe('serif');
      check(
        'container family and literal horizontal spaces',
        await page.evaluate(() => {
          const node = window.platform.text('p-text');
          const style = getComputedStyle(node);
          const box = window.platform.bounds(node);
          window.platform.observations.typography = {
            text: node.textContent,
            box: box.toJSON() as unknown,
            writing: style.writingMode,
            whitespace: style.whiteSpace,
            family: node.getAttribute('font-family'),
          };

          return (
            node.textContent === '  A  B  ' &&
            node.children.length === 0 &&
            style.writingMode === 'horizontal-tb' &&
            style.whiteSpace === 'pre' &&
            style.textTransform === 'none' &&
            node.getAttribute('stroke') === '#ffffff' &&
            node.getAttribute('stroke-width') === '3' &&
            node.getAttribute('paint-order') === 'stroke fill'
          );
        }),
      );
      const target = await labelTarget(page, 'p-text');
      expect(target.proof).toBe(true);
      const box = await page.evaluate(() => {
        const rect = window.platform.bounds(window.platform.text('p-text'));

        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      });
      const points = [box.x + 1, box.x - 1, box.x - 3];
      const hits: number[] = [];

      for (const x of points) {
        await clearEvents(page);
        await page.mouse.click(x, box.y + box.height / 2);
        hits.push(await clickCount(page));
      }

      check('native leading-space halo and outside picking', hits, [1, 1, 0]);
    },
  },
  {
    id: 'LABEL-03 / overlap, visibility and viewport clipping',
    subcases: [
      'later polygon covers earlier label',
      'removal exposes original label',
      'higher visible layer wins and hidden layer yields',
      'label beyond intersection bounds is pickable',
      'viewport clipped label does not pick outside',
    ],
    run: async ({ page, origin, check }): Promise<void> => {
      await openP(page, origin);
      await page.evaluate(() => {
        window.platform.layers['p-low']!.visible = false;
        window.platform.layers['p-high']!.visible = false;
      });
      const target = await labelTarget(page, 'p-text');
      expect(target.proof).toBe(true);
      await page.evaluate(target => {
        const { map, roots } = window.platform;
        const point = map.coordinates.clientToMap(target);
        const polygon = roots['p-flat']!;

        if (polygon.kind === 'polygon') {
          polygon.label = undefined;
          polygon.setContour([
            { x: point.x - 10, y: point.y - 10 },
            { x: point.x + 10, y: point.y - 10 },
            { x: point.x + 10, y: point.y + 10 },
            { x: point.x - 10, y: point.y + 10 },
          ]);
        }
      }, target);
      await clearEvents(page);
      await page.mouse.click(target.x, target.y);
      check('later polygon covers earlier label', await clickIdentity(page, 'p-flat', 'p-full'));
      await page.evaluate(() => {
        window.platform.layers['p-full']!.objectIds.remove('p-flat');
      });
      await clearEvents(page);
      await page.mouse.click(target.x, target.y);
      check('removal exposes original label', await clickIdentity(page, 'p-text', 'p-full'));
      await page.evaluate(() => {
        window.platform.layers['p-over']!.objectIds.add('p-text');
      });
      await clearEvents(page);
      await page.mouse.click(target.x, target.y);
      const high = await clickIdentity(page, 'p-text', 'p-over');
      await page.evaluate(() => {
        window.platform.layers['p-over']!.visible = false;
      });
      await clearEvents(page);
      await page.mouse.click(target.x, target.y);
      check(
        'higher visible layer wins and hidden layer yields',
        high && (await clickIdentity(page, 'p-text', 'p-full')),
      );

      // Narrow y bounds keep the route stroke at 130 but leave its downward label outside.
      await page.evaluate(async () => {
        const { map, definition } = window.platform;
        await map.load({
          ...definition,
          layers: definition.layers.map(layer =>
            layer.id === 'p-low'
              ? {
                  ...layer,
                  intersectionBounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 360, y: 140, z: 3 } },
                }
              : layer,
          ),
        });
        window.platform.saveReferences();
        window.platform.layers['p-high']!.visible = false;
      });
      await expect
        .poll(() => page.evaluate(() => !!window.platform.text('p-route', 'p-low')))
        .toBe(true);
      const beyond = await labelTarget(page, 'p-route', 'p-low');
      const beyondBounds = await page.evaluate(
        target => window.platform.map.coordinates.clientToMap(target).y > 140,
        beyond,
      );
      await clearEvents(page);
      await page.mouse.click(beyond.x, beyond.y);
      check(
        'label beyond intersection bounds is pickable',
        beyond.proof && beyondBounds && (await clickIdentity(page, 'p-route', 'p-low')),
      );
      await page.evaluate(() => {
        const { map, roots } = window.platform;
        map.camera.zoom = 2;
        map.camera.center = { x: 170, y: 45 };
        map.materials.get('labels')!.properties = {
          label: {
            origin: 'top left',
            font: { size: '20px' },
            offset: { x: `${map.camera.viewport.width / 2 - 20}px`, y: '30px' },
          },
        };
        roots['p-text']!.label = 'Viewport clipping label';
      });
      await expect
        .poll(() => page.evaluate(() => window.platform.text('p-text').textContent))
        .toBe('Viewport clipping label');
      const clip = await page.evaluate(() => {
        const { surface, text } = window.platform;
        const rect = window.platform.bounds(text('p-text'));
        const view = surface.getBoundingClientRect();

        return {
          inside: { x: view.right - 10, y: rect.y + rect.height / 2 },
          outside: { x: view.right + 10, y: rect.y + rect.height / 2 },
          straddles: rect.left < view.right && rect.right > view.right,
        };
      });
      await clearEvents(page);
      await page.mouse.click(clip.inside.x, clip.inside.y);
      const inside = await clickIdentity(page, 'p-text', 'p-full');
      await clearEvents(page);
      await page.mouse.click(clip.outside.x, clip.outside.y);
      check(
        'viewport clipped label does not pick outside',
        clip.straddles && inside && (await clickCount(page)) === 0,
      );
    },
  },
];
