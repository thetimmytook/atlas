import { expect } from 'vitest';

import { clearEvents, clickCount, clickIdentity, labelTarget, openP } from './browser.js';

import type { Scenario } from './browser.js';
import type { Page } from 'playwright';

async function sampleIcon(
  page: Page,
  rect: { x: number; y: number; width: number; height: number },
): Promise<number[][]> {
  const screenshot = await page.screenshot();

  return page.evaluate(
    async ({ data, rect }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0);
      const sample = (x: number): number[] =>
        Array.from(
          context.getImageData(Math.floor(x), Math.floor(rect.y + rect.height / 4), 1, 1).data,
        );
      const values = [
        sample(rect.x + rect.width / 8),
        sample(rect.x + (rect.width * 5) / 8),
        sample(rect.x + (rect.width * 7) / 8),
        sample(rect.x + rect.width * 1.025),
      ];
      const history = (window.platform.observations.renderedPixels ?? []) as unknown[];
      history.push({ rect, values });
      window.platform.observations.renderedPixels = history;

      return values;
    },
    { data: screenshot.toString('base64'), rect },
  );
}

export const MATERIALS: Scenario[] = [
  {
    id: 'MAT-02 / decoded SVG+PNG, screen rectangles and rendered colors',
    subcases: [
      'SVG and PNG intrinsic decode and dimensions',
      'aspect ratio anchor and zoom independence',
      'rendered red green and transparency preserved',
      'transparent rectangle native picking',
      'whole image replacement resumes inheritance',
    ],
    run: async ({ page, origin, check }): Promise<void> => {
      await openP(page, origin);
      const image = page.locator('[data-layer-id="p-full"] [data-object-id="p-icon"] image');
      const sizes: number[][] = [];
      const decodedPixels: number[][][] = [];

      for (const resource of ['svg', 'png']) {
        await page.evaluate(resource => {
          window.platform.map.materials.get('iconBase')!.properties = {
            symbol: 'image',
            image: { resource },
          };
        }, resource);
        await expect
          .poll(() =>
            image.evaluate(async node => {
              const response = await fetch(node.getAttribute('href')!);

              return response.headers.get('content-type')?.split(';')[0];
            }),
          )
          .toBe(resource === 'svg' ? 'image/svg+xml' : 'image/png');
        await expect.poll(async () => (await image.boundingBox())?.width).toBeCloseTo(40, 1);
        decodedPixels.push(await sampleIcon(page, (await image.boundingBox())!));
        sizes.push(
          await image.evaluate(async node => {
            const decoded = new Image();
            decoded.src = node.getAttribute('href')!;
            await decoded.decode();
            const rect = node.getBoundingClientRect();

            return [decoded.naturalWidth, decoded.naturalHeight, rect.width, rect.height];
          }),
        );
      }

      check(
        'SVG and PNG intrinsic decode and dimensions',
        sizes.every(size => size.every((value, i) => Math.abs(value - [40, 20, 40, 20][i]!) < 0.1)),
      );
      await page.evaluate(() => {
        window.platform.map.materials.get('iconBase')!.properties = {
          symbol: 'image',
          image: { resource: 'svg', width: 80, height: 80, anchor: { x: 0.5, y: 1 } },
        };
      });
      await expect.poll(async () => (await image.boundingBox())?.width).toBeCloseTo(80, 1);
      const anchors: boolean[] = [];

      for (const zoom of [1, 2, 4]) {
        await page.evaluate(zoom => {
          window.platform.map.camera.zoom = zoom;
        }, zoom);
        await expect
          .poll(() =>
            page.evaluate(() => {
              const { surface, map } = window.platform;
              const width = Number(surface.getAttribute('viewBox')!.split(' ')[2]);

              return Math.abs(width - map.camera.viewport.width / map.camera.zoom) < 0.001;
            }),
          )
          .toBe(true);
        anchors.push(
          await image.evaluate(node => {
            const rect = node.getBoundingClientRect();
            const position = window.platform.map.coordinates.mapToClient({ x: 40, y: 90 });
            window.platform.observations.iconRect = rect.toJSON() as unknown;

            return (
              Math.abs(rect.width - 80) < 0.1 &&
              Math.abs(rect.height - 40) < 0.1 &&
              Math.abs(rect.x - position.x + 40) < 0.1 &&
              Math.abs(rect.y - position.y + 40) < 0.1
            );
          }),
        );
      }

      check('aspect ratio anchor and zoom independence', anchors.every(Boolean));

      // At zoom=4 the icon is offscreen. Restore a known visible camera before native input/pixel sampling.
      await page.evaluate(() => {
        window.platform.map.camera.zoom = 2;
      });
      await expect.poll(async () => (await image.boundingBox())?.x).toBeGreaterThan(0);
      const rect = (await image.boundingBox())!;
      const pixels = await sampleIcon(page, rect);
      check(
        'rendered red green and transparency preserved',
        [...decodedPixels, pixels].every(
          values =>
            values[0]?.join() === '255,0,0,255' &&
            values[1]?.join() === '0,255,0,255' &&
            values[2]?.join() === values[3]?.join(),
        ),
      );
      await clearEvents(page);
      await page.mouse.click(rect.x + 70, rect.y + 10);
      const transparentHit = await clickIdentity(page, 'p-icon', 'p-full');
      await clearEvents(page);
      await page.mouse.click(rect.x + rect.width + 3, rect.y + 10);
      check(
        'transparent rectangle native picking',
        transparentHit && (await clickCount(page)) === 0,
      );
      await page.evaluate(() => {
        window.platform.map.materials.get('icon')!.properties = { image: { resource: 'png' } };
      });
      await expect.poll(async () => (await image.boundingBox())?.width).toBeCloseTo(40, 1);
      const small = (await image.boundingBox())!;
      await page.evaluate(() => {
        window.platform.map.materials.get('icon')!.properties = { color: '#ff00ff' };
      });
      await expect.poll(async () => (await image.boundingBox())?.width).toBeCloseTo(80, 1);
      check(
        'whole image replacement resumes inheritance',
        Math.abs(small.height - 20) < 0.1 &&
          Math.abs((await image.boundingBox())!.height - 40) < 0.1,
      );
    },
  },
  {
    id: 'MAT-01/03 / whole materials, invalid load and setter preservation',
    subcases: [
      'whole value edit and leaf inheritance',
      'invalid unused SVG preserves scene camera and references',
      'invalid material assignment and label preserve state and events',
      'native old label still picks after rejection',
    ],
    run: async ({ page, origin, check }): Promise<void> => {
      await openP(page, origin);
      const inheritance = await page.evaluate(() => {
        const { map, text, observations } = window.platform;
        const child = map.materials.get('child')!;
        const oldOwn = child.properties;
        const oldDefinition = map.definition;
        child.properties = { label: { font: { weight: 'normal' } } };
        observations.materialSnapshot = { oldOwn, current: child.properties };

        return (
          Object.isFrozen(oldOwn) &&
          oldOwn.label!.color === '#663399' &&
          oldOwn.label!.font!.weight === 'bold' &&
          child.properties.label!.color === undefined &&
          child.properties.label!.font!.weight === 'normal' &&
          map.definition === oldDefinition &&
          text('p-text').getAttribute('font-weight') === 'bold'
        );
      });
      await expect
        .poll(() => page.evaluate(() => window.platform.text('p-text').getAttribute('font-weight')))
        .toBe('normal');
      check(
        'whole value edit and leaf inheritance',
        inheritance &&
          (await page.evaluate(() => {
            const text = window.platform.text('p-text');

            return (
              text.getAttribute('fill') === '#222222' && text.getAttribute('font-size') === '20'
            );
          })),
      );
      const preserved = await page.evaluate(async () => {
        const { map, roots, layers, text, observations } = window.platform;
        const definition = map.definition!;
        const collection = map.objects;
        const lookup = map.materials;
        const handle = lookup.get('child');
        const snapshot = handle!.properties;
        const node = text('p-text');
        const center = map.camera.center;
        const zoom = map.camera.zoom;
        let code: string | undefined;

        try {
          await map.load({
            ...definition,
            resources: {
              ...definition.resources,
              unused: { kind: 'image', source: 'data:image/svg+xml,%3Cnot-svg%2F%3E' },
            },
          });
        } catch (error) {
          const failure = error as {
            name: string;
            code: string;
            message: string;
            details: unknown;
          };
          code = failure.code;
          observations.expectedLoadError = {
            name: failure.name,
            code,
            message: failure.message,
            details: failure.details,
          };
        }

        return (
          code === 'INVALID_IMAGE_RESOURCE' &&
          map.definition === definition &&
          map.objects === collection &&
          map.materials === lookup &&
          map.materials.get('child') === handle &&
          handle!.properties === snapshot &&
          map.objects.get('p-text') === roots['p-text'] &&
          map.layers.includes(layers['p-full']!) &&
          text('p-text') === node &&
          map.camera.center === center &&
          map.camera.zoom === zoom
        );
      });
      check('invalid unused SVG preserves scene camera and references', preserved);
      check(
        'invalid material assignment and label preserve state and events',
        await page.evaluate(() => {
          const { map, roots, observations } = window.platform;
          const owner = roots['p-text']!;
          const child = map.materials.get('child')!;
          const own = child.properties;
          const label = owner.label;
          const material = owner.material;
          let changes = 0;
          owner.addEventListener('change', () => changes++);
          const errors: string[] = [];

          for (const edit of [
            (): void => {
              child.properties = { label: { font: { size: '0px' } } };
            },
            (): void => {
              owner.material = 'missing';
            },
            ...['x\ny', 'x\ry', 'x\r\ny'].map(value => (): void => {
              owner.label = value;
            }),
          ]) {
            try {
              edit();
            } catch (error) {
              errors.push((error as { code: string }).code);
            }
          }

          observations.expectedSetterErrors = errors;

          return (
            errors.join() ===
              [
                'INVALID_MATERIAL_PROPERTY',
                'UNKNOWN_MATERIAL',
                ...Array<string>(3).fill('INVALID_OBJECT_LABEL'),
              ].join() &&
            child.properties === own &&
            owner.label === label &&
            owner.material === material &&
            changes === 0
          );
        }),
      );
      const target = await labelTarget(page, 'p-text');
      expect(target.proof).toBe(true);
      await clearEvents(page);
      await page.mouse.click(target.x, target.y);
      check(
        'native old label still picks after rejection',
        await clickIdentity(page, 'p-text', 'p-full'),
      );
    },
  },
];

export const FAILED_RESOURCE: Scenario = {
  id: 'LOAD-01 / MAT-03 / pending resource failure preserves usable scene',
  subcases: [
    'native old label remains usable during pending load',
    'failed request retains edited object scene and camera',
    'native preserved label picks after failed request',
  ],
  run: async ({ page, origin, check, expectedResourceUrls }): Promise<void> => {
    await openP(page, origin);
    const target = await labelTarget(page, 'p-text');
    expect(target.proof).toBe(true);
    const url = `${origin}/platform-deliberately-failed.svg`;
    expectedResourceUrls.push(url);
    let pending: import('playwright').Route | undefined;
    await page.route(url, route => {
      pending = route;
    });
    await page.evaluate(url => {
      const { map, roots, observations } = window.platform;
      const definition = map.definition!;
      const lookup = map.materials;
      const layers = map.layers;
      const center = map.camera.center;
      const zoom = map.camera.zoom;
      observations.loadSettled = false;

      // Keep the public load pending while Node performs a later trusted mouse action.
      void map
        .load({
          ...definition,
          resources: { ...definition.resources, unused: { kind: 'image', source: url } },
        })
        .then(() => {
          observations.unexpectedLoadSuccess = true;
        })
        .catch((error: unknown) => {
          observations.expectedRequestError = (error as { code: string }).code;
          observations.requestPreservation =
            map.definition === definition &&
            map.materials === lookup &&
            map.layers === layers &&
            map.objects.get('p-text') === roots['p-text'] &&
            map.camera.center === center &&
            map.camera.zoom === zoom;
        })
        .finally(() => {
          observations.loadSettled = true;
        });
    }, url);
    await expect.poll(() => !!pending).toBe(true);

    try {
      await clearEvents(page);
      await page.mouse.click(target.x, target.y);
      check(
        'native old label remains usable during pending load',
        (await clickIdentity(page, 'p-text', 'p-full')) &&
          (await page.evaluate(() => window.platform.observations.loadSettled === false)),
      );
      await page.evaluate(() => {
        window.platform.roots['p-text']!.label = 'Edited while pending';
      });
    } finally {
      await pending!.abort('failed');
    }

    await expect
      .poll(() => page.evaluate(() => window.platform.observations.loadSettled))
      .toBe(true);
    await expect
      .poll(() => page.evaluate(() => window.platform.text('p-text').textContent))
      .toBe('Edited while pending');
    check(
      'failed request retains edited object scene and camera',
      await page.evaluate(() => {
        const { observations, roots } = window.platform;

        return (
          observations.expectedRequestError === 'IMAGE_RESOURCE_LOAD_FAILED' &&
          observations.requestPreservation === true &&
          roots['p-text']!.label === 'Edited while pending'
        );
      }),
    );
    await clearEvents(page);
    await page.mouse.click(target.x, target.y);
    check(
      'native preserved label picks after failed request',
      await clickIdentity(page, 'p-text', 'p-full'),
    );
  },
};
