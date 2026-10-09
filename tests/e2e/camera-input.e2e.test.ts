import { mkdir } from 'node:fs/promises';

import { chromium } from 'playwright';
import { createServer } from 'vite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import type { ClickTrigger } from '#interaction/map-surface-event.js';
import type { Browser, BrowserContext, CDPSession, Page } from 'playwright';
import type { ViteDevServer } from 'vite';

const DIAGNOSTICS_DIR = 'node_modules/.cache/e2e-camera-input';
const target = { x: 440, y: 240 };
const empty = { x: 200, y: 240 };
let server: ViteDevServer;
let browser: Browser;
let context: BrowserContext;
let page: Page;
let cdp: CDPSession;
let origin: string;
let pageErrors: string[];

beforeAll(async () => {
  // Serve the focused source fixture without building or replacing the shared dist.
  server = await createServer({
    configFile: false,
    server: { host: '127.0.0.1', port: 0, strictPort: true, open: false },
  });
  await server.listen();
  const address = server.httpServer!.address();

  if (!address || typeof address === 'string') {
    throw new Error('Input fixture server has no TCP address.');
  }

  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

beforeEach(async () => {
  // Desktop Chromium with touch emulation; this is not physical mobile validation.
  context = await browser.newContext({ viewport: { width: 900, height: 700 }, hasTouch: true });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  page = await context.newPage();
  cdp = await context.newCDPSession(page);
  pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(`${origin}/tests/e2e/fixtures/camera-input.html`);
  await expect
    .poll(() => page.evaluate(() => window.cameraInput?.map.camera.viewport.width))
    .toBe(640);
  await frame();
});

afterEach(async ({ task }) => {
  try {
    expect(pageErrors).toEqual([]);
  } finally {
    if (task.result?.state === 'fail') {
      await mkdir(DIAGNOSTICS_DIR, { recursive: true });
      await context.tracing.stop({ path: `${DIAGNOSTICS_DIR}/${task.id}.zip` });
    } else {
      await context.tracing.stop();
    }

    await context.close();
  }
});

async function frame(): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

async function state(): Promise<{
  x: number;
  y: number;
  zoom: number;
  events: Window['cameraInput']['events'];
  clicks: Window['cameraInput']['clicks'];
  inputs: Window['cameraInput']['inputs'];
}> {
  return page.evaluate(() => {
    const { map, events, clicks, inputs } = window.cameraInput;

    return {
      x: map.camera.center.x,
      y: map.camera.center.y,
      zoom: map.camera.zoom,
      events,
      clicks,
      inputs,
    };
  });
}

async function client(point: { x: number; y: number }): Promise<{ x: number; y: number }> {
  const bounds = (await page.locator('atlas-input-test svg').boundingBox())!;

  return { x: bounds.x + point.x, y: bounds.y + point.y };
}

async function trigger(value: ClickTrigger): Promise<void> {
  await page.evaluate(value => {
    window.cameraInput.map.clickTrigger = value;
  }, value);
}

async function touch(
  type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel',
  points: { id: number; x: number; y: number }[],
): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  await frame();
}

async function mouseDown(point = target): Promise<{ x: number; y: number }> {
  const position = await client(point);
  await page.mouse.move(position.x, position.y);
  await page.mouse.down();

  return position;
}

async function clickTarget(): Promise<void> {
  await mouseDown();
  await page.mouse.up();
}

async function expectPaintedTarget(x: number, y: number): Promise<void> {
  await frame();
  const bounds = (await page.locator('atlas-input-test svg circle').boundingBox())!;
  expect(bounds.x + bounds.width / 2).toBeCloseTo(x, 5);
  expect(bounds.y + bounds.height / 2).toBeCloseTo(y, 5);
}

function expectView(view: Awaited<ReturnType<typeof state>>, x: number, y: number, zoom = 1): void {
  expect(view.x).toBeCloseTo(x, 7);
  expect(view.y).toBeCloseTo(y, 7);
  expect(view.zoom).toBeCloseTo(zoom, 7);
}

function expectTouchInput(view: Awaited<ReturnType<typeof state>>, downs: number): void {
  const starts = view.inputs.filter(event => event.type === 'pointerdown');
  expect(starts).toHaveLength(downs);
  expect(starts.every(event => event.trusted && event.pointerType === 'touch')).toBe(true);
  expect(
    view.inputs.filter(event => event.type === 'pointermove').every(event => event.trusted),
  ).toBe(true);
}

describe('camera/input through real browser input', () => {
  test.each(['press', 'release'] as const)(
    'single %s click keeps threshold and emits only once',
    async mode => {
      await trigger(mode);
      const position = await mouseDown();
      expect((await state()).clicks).toHaveLength(mode === 'press' ? 1 : 0);
      await page.mouse.move(position.x + 3, position.y + 4);
      expectView(await state(), 320, 240);
      await page.mouse.up();
      const view = await state();
      expect(view.clicks).toEqual([{ id: 'target', sameObject: true, layerId: 'content' }]);
      expect(view.events).toEqual([
        { type: 'press', keys: ['clientPoint', 'mapPoint'] },
        {
          type: 'release',
          isClick: mode === 'release',
          keys: ['clientPoint', 'isClick', 'mapPoint'],
        },
      ]);
      expect(
        view.inputs.filter(event => event.type === 'pointerdown').every(event => event.trusted),
      ).toBe(true);
    },
  );

  test.each(['press', 'release'] as const)(
    'single touch tap clicks exactly once in %s mode',
    async mode => {
      await trigger(mode);
      const position = await client(target);
      await touch('touchStart', [{ id: 1, ...position }]);
      expect((await state()).clicks).toHaveLength(mode === 'press' ? 1 : 0);
      await touch('touchEnd', []);
      const view = await state();
      expectView(view, 320, 240);
      expect(view.clicks).toEqual([{ id: 'target', sameObject: true, layerId: 'content' }]);
      expect(view.events.at(-1)).toMatchObject({ type: 'release', isClick: mode === 'release' });
      expectTouchInput(view, 1);
    },
  );

  test('mouse pan crosses the threshold and returning to the target does not restore click', async () => {
    const position = await mouseDown();
    await page.mouse.move(position.x + 80, position.y + 30, { steps: 4 });
    expectView(await state(), 240, 210);
    await expectPaintedTarget(position.x + 80, position.y + 30);
    await page.mouse.move(position.x, position.y, { steps: 4 });
    await page.mouse.up();
    const view = await state();
    expectView(view, 320, 240);
    expect(view.clicks).toHaveLength(0);
    expect(view.events.at(-1)).toMatchObject({ type: 'release', isClick: false });
    await clickTarget();
    expect((await state()).clicks).toHaveLength(1);
  });

  test('wheel zoom preserves the map anchor under the cursor', async () => {
    const position = await client({ x: 160, y: 120 });
    await page.mouse.move(position.x, position.y);
    await page.mouse.wheel(0, -240);
    await expect.poll(async () => (await state()).zoom).toBeGreaterThan(1);
    const zoom = Math.exp(0.48);
    expectView(await state(), 160 + 160 / zoom, 120 + 120 / zoom, zoom);
    const anchor = await page.evaluate(
      position => window.cameraInput.map.coordinates.clientToMap(position),
      position,
    );
    expect(anchor.x).toBeCloseTo(160, 7);
    expect(anchor.y).toBeCloseTo(120, 7);
    expect((await state()).clicks).toHaveLength(0);
  });

  test.each(['press', 'release'] as const)('touch pan in %s mode suppresses click', async mode => {
    await trigger(mode);
    const start = await client(empty);
    await touch('touchStart', [{ id: 1, ...start }]);
    await touch('touchMove', [{ id: 1, x: start.x + 60, y: start.y + 30 }]);
    expectView(await state(), 260, 210);
    await touch('touchEnd', []);
    const view = await state();
    expect(view.clicks).toHaveLength(0);
    expect(view.events.at(-1)).toMatchObject({ type: 'release', isClick: false });
    expectTouchInput(view, 1);
  });

  test.each(['press', 'release'] as const)(
    'empty first finger then object second finger preserves pinch in %s mode',
    async mode => {
      await trigger(mode);
      const first = await client(empty);
      const second = await client(target);
      await touch('touchStart', [{ id: 1, ...first }]);

      // CDP touchMove supplies the active set: a new ID produces a native pointerdown.
      await touch('touchMove', [
        { id: 1, ...first },
        { id: 2, ...second },
      ]);
      let view = await state();
      expect(view.events.filter(event => event.type === 'press')).toHaveLength(2);
      expect(view.events.every(event => event.keys.join(',') === 'clientPoint,mapPoint')).toBe(
        true,
      );
      expect(view.clicks).toHaveLength(0);
      await touch('touchMove', [
        { id: 1, x: first.x - 40, y: first.y + 30 },
        { id: 2, x: second.x + 80, y: second.y + 30 },
      ]);
      view = await state();
      expectView(view, 320 - 20 / 1.5, 240 - 30 / 1.5, 1.5);
      await expectPaintedTarget(second.x + 80, second.y + 30);

      // Lifting the second pointer must not jump; the remaining finger pans at the new zoom.
      // Chromium's WebTouch CDP path names the released point in touchEnd.
      await touch('touchEnd', [{ id: 2, x: second.x + 80, y: second.y + 30 }]);
      expect((await state()).events.filter(event => event.type === 'release')).toHaveLength(1);
      expectView(await state(), view.x, view.y, view.zoom);
      await touch('touchMove', [{ id: 1, x: first.x - 10, y: first.y + 45 }]);
      expectView(await state(), view.x - 20, view.y - 10, 1.5);
      await touch('touchEnd', []);
      view = await state();
      expect(view.clicks).toHaveLength(0);
      expect(
        view.events.filter(event => event.type === 'release').map(event => event.isClick),
      ).toEqual([false, false]);
      expectTouchInput(view, 2);
    },
  );

  test('first object press consumes pan, pinch and wheel until every finger ends', async () => {
    await trigger('press');
    const first = await client(target);
    const second = await client(empty);
    await touch('touchStart', [{ id: 1, ...first }]);
    expect((await state()).clicks).toHaveLength(1);
    await touch('touchMove', [{ id: 1, x: first.x + 20, y: first.y }]);
    await touch('touchMove', [
      { id: 1, x: first.x + 20, y: first.y },
      { id: 2, ...second },
    ]);
    await touch('touchMove', [
      { id: 1, x: first.x + 80, y: first.y + 30 },
      { id: 2, x: second.x - 40, y: second.y + 30 },
    ]);
    await page.mouse.move(second.x, second.y);
    await page.mouse.wheel(0, -240);
    await frame();
    expectView(await state(), 320, 240);
    await touch('touchEnd', [{ id: 1, x: first.x + 80, y: first.y + 30 }]);
    await touch('touchMove', [{ id: 2, x: second.x, y: second.y + 60 }]);
    expectView(await state(), 320, 240);
    await touch('touchEnd', []);
    const view = await state();
    expect(view.clicks).toHaveLength(1);
    expect(view.events.filter(event => event.type === 'press')).toHaveLength(2);
    expect(
      view.events.filter(event => event.type === 'release').map(event => event.isClick),
    ).toEqual([false, false]);
    expectTouchInput(view, 2);
    await touch('touchStart', [{ id: 3, ...second }]);
    await touch('touchMove', [{ id: 3, x: second.x + 40, y: second.y }]);
    await touch('touchEnd', []);
    expectView(await state(), 280, 240);
    expect((await state()).clicks).toHaveLength(1);
  });

  test.each(['press', 'release'] as const)(
    'native touch cancellation cleans up %s state without release',
    async mode => {
      await trigger(mode);
      const first = await client(target);
      await touch('touchStart', [{ id: 1, ...first }]);
      await touch('touchCancel', []);
      const cancelled = await state();
      expect(cancelled.inputs.some(event => event.type === 'pointercancel' && event.trusted)).toBe(
        true,
      );
      expect(cancelled.events.filter(event => event.type === 'release')).toHaveLength(0);
      expect(cancelled.clicks).toHaveLength(mode === 'press' ? 1 : 0);
      await clickTarget();
      expect((await state()).clicks).toHaveLength(mode === 'press' ? 2 : 1);
      const start = await mouseDown(empty);
      await page.mouse.move(start.x + 40, start.y);
      await page.mouse.up();
      expectView(await state(), 280, 240);
    },
  );

  test.each(['press', 'release'] as const)(
    'native lost capture clears %s state without a normal release',
    async mode => {
      await trigger(mode);
      const start = await mouseDown();

      // Activate the pending native capture before releasing it.
      await page.mouse.move(start.x + 1, start.y);
      await page.evaluate(() => {
        const { surface, inputs } = window.cameraInput;
        surface.releasePointerCapture(
          inputs.find(event => event.type === 'pointerdown')!.pointerId,
        );
      });
      await page.mouse.move(start.x + 20, start.y);
      await expect
        .poll(async () =>
          (await state()).inputs.some(
            event => event.type === 'lostpointercapture' && event.trusted,
          ),
        )
        .toBe(true);
      await page.mouse.up();
      const view = await state();
      expectView(view, 320, 240);
      expect(view.events.filter(event => event.type === 'release')).toHaveLength(0);
      expect(view.clicks).toHaveLength(mode === 'press' ? 1 : 0);
      await clickTarget();
      expect((await state()).clicks).toHaveLength(mode === 'press' ? 2 : 1);
    },
  );

  test.each(['press', 'release'] as const)(
    'disconnect/reconnect discards the active %s gesture',
    async mode => {
      await trigger(mode);
      await mouseDown();
      await page.evaluate(() => {
        const { map } = window.cameraInput;
        map.remove();
        document.body.append(map);
      });
      await page.mouse.up();
      expect((await state()).events.filter(event => event.type === 'release')).toHaveLength(0);
      await clickTarget();
      const view = await state();
      expect(view.clicks).toHaveLength(mode === 'press' ? 2 : 1);
      expect(view.events.filter(event => event.type === 'press')).toHaveLength(2);
      expect(view.events.filter(event => event.type === 'release')).toHaveLength(1);
      const start = await mouseDown(empty);
      await page.mouse.move(start.x + 40, start.y);
      await page.mouse.up();
      expectView(await state(), 280, 240);
    },
  );

  test('changing clickTrigger during a press cancels the old candidate, including a round trip', async () => {
    await page.evaluate(() => {
      const { map } = window.cameraInput;
      map.clickTrigger = 'press';
      map.addEventListener(
        'press',
        () => {
          map.clickTrigger = 'release';
          map.clickTrigger = 'press';
        },
        { once: true },
      );
    });
    await clickTarget();
    expect((await state()).clicks).toHaveLength(0);
    await clickTarget();
    expect((await state()).clicks).toHaveLength(1);
    await trigger('release');
    await mouseDown();
    await trigger('press');
    await trigger('release');
    await page.mouse.up();
    expect((await state()).clicks).toHaveLength(1);
    await clickTarget();
    expect((await state()).clicks).toHaveLength(2);
  });

  test.each(['press', 'release'] as const)(
    'revalidates a captured hit after a synchronous %s handler moves the object',
    async mode => {
      await trigger(mode);
      await page.evaluate(mode => {
        const { map } = window.cameraInput;
        map.addEventListener(
          mode,
          () => {
            const point = map.objects.get('target')!;

            if (point.kind === 'point') {
              point.position = { x: 500, y: 300, z: 0 };
            }
          },
          { once: true },
        );
      }, mode);
      await clickTarget();
      expect((await state()).clicks).toHaveLength(0);
      await mouseDown({ x: 500, y: 300 });
      await page.mouse.up();
      expect((await state()).clicks).toHaveLength(1);
    },
  );
});
