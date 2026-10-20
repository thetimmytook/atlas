import { expect } from 'vitest';

import { clearEvents, clickCount, clickIdentity, labelTarget, openP } from './browser.js';
import { installProbe } from './fixture.js';

import type { Scenario } from './browser.js';

export const LIFECYCLE: Scenario[] = [
  {
    id: 'LABEL-04 / native before-RAF edits and nested batch',
    subcases: [
      'batch commits state and events while DOM is old',
      'same native press picks new geometry text and material before RAF',
      'subsequent paint matches committed state',
    ],
    run: async ({ page, origin, check }): Promise<void> => {
      await openP(page, origin);
      const target = await page.evaluate(() => {
        const { map, surface, roots, text, observations } = window.platform;
        map.clickTrigger = 'press';
        const oldText = text('p-text').textContent;
        const oldTransform = text('p-text').parentElement!.getAttribute('transform');
        const position = map.coordinates.mapToClient({ x: 140, y: 45 });
        const client = { x: position.x + 4, y: position.y + 65 };
        const changes: { label: string | undefined; x: number | undefined }[] = [];
        roots['p-text']!.addEventListener('change', () => {
          const point = roots['p-text']!;
          changes.push({
            label: point.label,
            x: point.kind === 'point' ? point.position.x : undefined,
          });
        });
        surface.addEventListener(
          'pointerdown',
          () => {
            map.batch(() => {
              map.batch(() => {
                const point = roots['p-text']!;
                point.label = 'Longer label';

                if (point.kind === 'point') {
                  point.position = { x: 140, y: 45, z: 9 };
                }

                map.materials.get('labels')!.properties = {
                  label: {
                    font: { size: '20px' },
                    origin: 'top left',
                    offset: { x: '0px', y: '60px' },
                  },
                };
              });
              const point = roots['p-text']!;
              observations.insideBatch = {
                label: point.label,
                x: point.kind === 'point' ? point.position.x : undefined,
                offset: map.materials.get('labels')!.properties.label!.offset!.y,
                oldText: text('p-text').textContent === oldText,
                oldTransform:
                  text('p-text').parentElement!.getAttribute('transform') === oldTransform,
                changes: changes.slice(),
              };
            });
            observations.afterBatchOldDom = text('p-text').textContent === oldText;
          },
          { capture: true, once: true },
        );

        return client;
      });
      await clearEvents(page);
      await page.mouse.click(target.x, target.y);
      check(
        'batch commits state and events while DOM is old',
        await page.evaluate(() => {
          const value = window.platform.observations.insideBatch as {
            label: string;
            x: number;
            offset: string;
            oldText: boolean;
            oldTransform: boolean;
            changes: unknown[];
          };

          return (
            value.label === 'Longer label' &&
            value.x === 140 &&
            value.offset === '60px' &&
            value.oldText &&
            value.oldTransform &&
            value.changes.length === 2 &&
            window.platform.observations.afterBatchOldDom === true
          );
        }),
      );
      check(
        'same native press picks new geometry text and material before RAF',
        await clickIdentity(page, 'p-text', 'p-full'),
      );
      await expect
        .poll(() => page.evaluate(() => window.platform.text('p-text').textContent))
        .toBe('Longer label');
      check(
        'subsequent paint matches committed state',
        await page.evaluate(target => {
          const { text } = window.platform;
          const rect = text('p-text').getBoundingClientRect();

          return (
            target.x > rect.left &&
            target.x < rect.right &&
            target.y > rect.top &&
            target.y < rect.bottom
          );
        }, target),
      );
    },
  },
  {
    id: 'EVENT-02 / LABEL-04 / stale captured hits',
    subcases: [
      'press capture suppression without underlying fallback',
      'release capture suppression without underlying fallback',
    ],
    run: async ({ page, origin, check }): Promise<void> => {
      const modeEvents: unknown[] = [];

      for (const mode of ['press', 'release'] as const) {
        await openP(page, origin);
        await page.evaluate(mode => {
          const { map, layers, observations } = window.platform;
          map.clickTrigger = mode;
          layers['p-over']!.objectIds.add('p-text');
          map.addEventListener(
            mode,
            () => {
              layers['p-over']!.visible = false;
              observations.suppressed = {
                underlyingVisible: layers['p-full']!.visible,
                hidden: !layers['p-over']!.visible,
              };
            },
            { once: true },
          );
        }, mode);
        await expect
          .poll(() => page.evaluate(() => !!window.platform.text('p-text', 'p-over')))
          .toBe(true);
        const target = await labelTarget(page, 'p-text', 'p-over');
        expect(target.proof).toBe(true);
        await clearEvents(page);
        await page.mouse.click(target.x, target.y);
        check(
          `${mode} capture suppression without underlying fallback`,
          (await clickCount(page)) === 0 &&
            (await page.evaluate(() => {
              const { layers, events } = window.platform;

              return (
                layers['p-full']!.visible &&
                !layers['p-over']!.visible &&
                events.some(event => event.type === 'pointerdown' && event.trusted)
              );
            })),
        );
        modeEvents.push({ mode, events: await page.evaluate(() => window.platform.eventHistory) });
      }

      await page.evaluate(events => {
        window.platform.observations.capturedModes = events;
      }, modeEvents);
    },
  },
  {
    id: 'EDIT-03 / LIFE-02 / LABEL-06 / removal and reconnect',
    subcases: [
      'removed label stops picking',
      'original edited instance reattaches without ghost label',
      'disconnect edits and reconnect restore current typography identity',
    ],
    run: async ({ page, origin, check }): Promise<void> => {
      await openP(page, origin);
      const old = await labelTarget(page, 'p-text');
      expect(old.proof).toBe(true);
      await page.evaluate(() => {
        window.platform.map.objects.remove(window.platform.roots['p-text']!);
      });
      await expect
        .poll(() => page.locator('[data-layer-id="p-full"] [data-object-id="p-text"]').count())
        .toBe(0);
      await clearEvents(page);
      await page.mouse.click(old.x, old.y);
      check('removed label stops picking', await clickCount(page), 0);
      await page.evaluate(() => {
        const { map, roots } = window.platform;
        const point = roots['p-text']!;
        point.label = 'Reattached';

        if (point.kind === 'point') {
          point.position = { x: 140, y: 70, z: 9 };
        }

        map.objects.add(point);
      });
      await expect
        .poll(() => page.evaluate(() => window.platform.text('p-text')?.textContent))
        .toBe('Reattached');
      const current = await labelTarget(page, 'p-text');
      await clearEvents(page);
      await page.mouse.click(old.x, old.y);
      const oldMiss = (await clickCount(page)) === 0;
      await clearEvents(page);
      await page.mouse.click(current.x, current.y);
      check(
        'original edited instance reattaches without ghost label',
        oldMiss && current.proof && (await clickIdentity(page, 'p-text', 'p-full')),
      );
      await page.evaluate(() => {
        const { map, roots, observations } = window.platform;
        const parent = map.parentNode!;
        const next = map.nextSibling;
        const layers = map.layers;
        const definition = map.definition;
        map.remove();
        roots['p-text']!.label = 'Reconnected';
        map.style.fontFamily = 'serif';
        map.materials.get('child')!.properties = { label: { color: '#008000' } };
        parent.insertBefore(map, next);
        observations.reconnect = {
          sameLayers: map.layers === layers,
          sameDefinition: map.definition === definition,
        };
      });
      await expect
        .poll(() =>
          page.evaluate(() => window.platform.text('p-text')?.getAttribute('font-family')),
        )
        .toBe('serif');
      await expect
        .poll(() => page.evaluate(() => window.platform.text('p-text')?.textContent))
        .toBe('Reconnected');
      const reconnected = await labelTarget(page, 'p-text');
      await clearEvents(page);
      await page.mouse.click(reconnected.x, reconnected.y);
      check(
        'disconnect edits and reconnect restore current typography identity',
        reconnected.proof &&
          (await clickIdentity(page, 'p-text', 'p-full')) &&
          (await page.evaluate(() => {
            const { text, observations } = window.platform;
            const state = observations.reconnect as {
              sameLayers: boolean;
              sameDefinition: boolean;
            };

            return (
              text('p-text').getAttribute('fill') === '#008000' &&
              state.sameLayers &&
              state.sameDefinition
            );
          })),
      );
    },
  },
  {
    id: 'LABEL-06 / one runtime object in two maps',
    subcases: [
      'empty second load clears direct IDs and attaches same instance',
      'shared edits retain independent material and typography',
      'disconnected consumer rejects assignment atomically',
      'native picks in both maps after reconnect',
    ],
    run: async ({ page, origin, check }): Promise<void> => {
      await openP(page, origin);
      await page.evaluate(() => {
        const second = document.createElement('atlas-buildings');
        second.id = 'second-map';
        second.style.cssText = 'display:block;width:360px;height:240px;font-family:serif';
        document.body.append(second);
      });
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (document.querySelector('#second-map') as typeof window.platform.map).camera.viewport
                .width,
          ),
        )
        .toBe(360);
      check(
        'empty second load clears direct IDs and attaches same instance',
        await page.evaluate(async () => {
          const { map, roots, definition } = window.platform;
          const second = document.querySelector('#second-map') as typeof map;
          const materials = { ...definition.materials };
          delete materials.onlyFirst;
          await second.load({
            ...definition,
            objects: [],
            materials,
            layers: definition.layers.map(layer => ({ ...layer, objects: [] })),
          });
          const emptyIds = second.layers.every(layer => Array.from(layer.objectIds).length === 0);
          second.objects.add(roots['p-text']!);
          second.layers.find(layer => layer.id === 'p-full')!.objectIds.add('p-text');
          second.camera.center = { x: 170, y: 45 };
          second.camera.zoom = 1;

          return (
            emptyIds &&
            second.objects.get('p-text') === map.objects.get('p-text') &&
            second.objects.get('p-text') === roots['p-text']
          );
        }),
      );

      // Give the second map its own reference recorder, then restore the first probe.
      await page.evaluate(() => {
        window.secondPlatform = window.platform;
      });
      await page.evaluate(installProbe, '#second-map');
      await page.evaluate(() => {
        const second = window.platform;
        window.platform = window.secondPlatform!;
        window.secondPlatform = second;
        const { roots, map } = window.platform;
        roots['p-text']!.label = 'Shared edit';

        if (roots['p-text']!.kind === 'point') {
          roots['p-text']!.position = { x: 170, y: 60, z: 9 };
        }

        map.materials.get('child')!.properties = { label: { color: '#ff0000' } };
      });
      await expect
        .poll(() => page.evaluate(() => window.secondPlatform!.text('p-text')?.textContent))
        .toBe('Shared edit');
      await expect
        .poll(() => page.evaluate(() => window.platform.text('p-text')?.getAttribute('fill')))
        .toBe('#ff0000');
      check(
        'shared edits retain independent material and typography',
        await page.evaluate(() => {
          const first = window.platform;
          const second = window.secondPlatform!;
          const owner = first.roots['p-text']!;
          first.observations.sharedStyle = {
            first: first.text('p-text').getAttribute('font-family'),
            second: second.text('p-text').getAttribute('font-family'),
          };

          return (
            second.map.objects.get('p-text') === owner &&
            owner.kind === 'point' &&
            owner.position.y === 60 &&
            first.text('p-text').getAttribute('font-family') === 'monospace' &&
            second.text('p-text').getAttribute('font-family') === 'serif' &&
            second.text('p-text').getAttribute('fill') === '#663399' &&
            second.map.materials.get('child')!.properties.label!.color === '#663399'
          );
        }),
      );
      check(
        'disconnected consumer rejects assignment atomically',
        await page.evaluate(() => {
          const first = window.platform;
          const second = window.secondPlatform!;
          const owner = first.roots['p-text']!;
          const snapshot = second.map.materials.get('child')!.properties;
          const material = owner.material;
          const parent = second.map.parentNode!;
          second.map.remove();
          let changes = 0;
          owner.addEventListener('change', () => changes++);
          let code: string | undefined;

          try {
            owner.material = 'onlyFirst';
          } catch (error) {
            code = (error as { code: string }).code;
          }

          first.observations.sharedRejection = { code, changes, material: owner.material };
          parent.appendChild(second.map);

          return (
            code === 'UNKNOWN_MATERIAL' &&
            changes === 0 &&
            owner.material === material &&
            second.map.materials.get('child')!.properties === snapshot
          );
        }),
      );
      const hits: boolean[] = [];

      for (const second of [false, true]) {
        if (second) {
          await page.evaluate(() => {
            const first = window.platform;
            window.platform = window.secondPlatform!;
            window.secondPlatform = first;
          });
        }

        await page
          .locator(second ? '#second-map' : 'atlas-buildings:not(#second-map)')
          .scrollIntoViewIfNeeded();
        await expect.poll(() => page.evaluate(() => !!window.platform.text('p-text'))).toBe(true);
        const target = await labelTarget(page, 'p-text');
        await clearEvents(page);
        await page.mouse.click(target.x, target.y);
        hits.push(
          target.proof &&
            (await clickIdentity(page, 'p-text', 'p-full')) &&
            (await clickCount(page)) === 1,
        );
      }

      check('native picks in both maps after reconnect', hits, [true, true]);
      await page.evaluate(() => {
        const second = window.platform;
        window.platform = window.secondPlatform!;
        window.secondPlatform = second;
        window.platform.observations.secondEvents = second.events;
      });
    },
  },
];
